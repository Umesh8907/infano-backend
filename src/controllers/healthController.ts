import { Request, Response, NextFunction } from 'express';
import DailyLog from '../models/DailyLog';
import User from '../models/User';
import { syncUserCyclesFromLogs } from '../services/cycleService';
import { updatePredictionCache } from '../services/predictionService';
import CyclePrediction from '../models/CyclePrediction';
import { NotFoundError, ValidationError } from '../utils/appError';
import { logger } from '../utils/logger';

/**
 * Helper to parse a date string into normalized midnight date
 */
const parseNormalizedDate = (dateStr: string): Date => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date parameter format');
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/**
 * @desc    Create or update daily log entry
 * @route   POST /api/v1/health/logs
 * @access  Private
 */
export const saveDailyLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new ValidationError('Authentication credentials not found'));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new NotFoundError('User profile not found'));
    }

    const {
      date,
      period_started,
      period_ended,
      flow,
      mood,
      energy_level,
      sleep_hours,
      symptoms,
      water_intake_cups,
      exercise_minutes,
      weight_kg,
      notes,
    } = req.body;

    const normalizedDate = parseNormalizedDate(date);

    // Upsert the daily log record
    const log = await DailyLog.findOneAndUpdate(
      { user_id: userId, date: normalizedDate },
      {
        user_id: userId,
        date: normalizedDate,
        period_started: period_started ?? false,
        period_ended: period_ended ?? false,
        flow: flow ?? 'none',
        mood: mood ?? [],
        energy_level,
        sleep_hours,
        symptoms: symptoms ?? [],
        water_intake_cups,
        exercise_minutes,
        weight_kg,
        notes,
      },
      { upsert: true, new: true }
    ).exec();

    logger.info(`Saved daily log for user: ${userId} on date: ${date}`);

    // Trigger cycle rebuilding and prediction updates
    await syncUserCyclesFromLogs(userId);
    const prediction = await updatePredictionCache(userId, user, new Date());

    res.status(200).json({
      status: 'success',
      message: 'Daily log saved successfully',
      data: {
        log,
        prediction,
        xp_awarded: 5, // Daily logging XP bonus
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Retrieve logs within a specific date range
 * @route   GET /api/v1/health/logs
 * @access  Private
 */
export const getLogsRange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new ValidationError('Authentication credentials not found'));
    }
    const { from, to } = req.query as { from: string; to: string };

    const startDate = parseNormalizedDate(from);
    const endDate = parseNormalizedDate(to);

    const logs = await DailyLog.find({
      user_id: userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: 1 })
      .exec();

    res.status(200).json({
      status: 'success',
      data: {
        logs,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get log for a specific date
 * @route   GET /api/v1/health/logs/:date
 * @access  Private
 */
export const getLogByDate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new ValidationError('Authentication credentials not found'));
    }
    const { date } = req.params;

    const normalizedDate = parseNormalizedDate(date);

    const log = await DailyLog.findOne({
      user_id: userId,
      date: normalizedDate,
    }).exec();

    res.status(200).json({
      status: 'success',
      data: {
        log,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Retrieve latest predictions for user
 * @route   GET /api/v1/health/predictions/current
 * @access  Private
 */
export const getCurrentPrediction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new ValidationError('Authentication credentials not found'));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new NotFoundError('User profile not found'));
    }

    // Always fetch latest recalculation or cached
    const prediction = await updatePredictionCache(userId, user, new Date());

    res.status(200).json({
      status: 'success',
      data: {
        prediction,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Retrieve monthly calendar events (predicted + logged)
 * @route   GET /api/v1/health/predictions/calendar
 * @access  Private
 */
export const getCalendarEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new ValidationError('Authentication credentials not found'));
    }
    const { month } = req.query as { month: string }; // Format YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return next(new ValidationError('Month parameter is required and must be in YYYY-MM format'));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new NotFoundError('User profile not found'));
    }

    const yearNum = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]) - 1; // 0-indexed

    const startOfMonth = new Date(Date.UTC(yearNum, monthNum, 1));
    const endOfMonth = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));

    // Retrieve daily logs in the month
    const logs = await DailyLog.find({
      user_id: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).exec();

    // Get current predictions
    const prediction = await updatePredictionCache(userId, user, new Date());

    const events: any[] = [];

    // Map through each calendar day in the month
    const currentDate = new Date(startOfMonth);
    while (currentDate <= endOfMonth) {
      const dayTime = currentDate.getTime();
      const dateStr = currentDate.toISOString().split('T')[0];

      // Find matching log
      const log = logs.find(l => {
        const logTime = new Date(l.date).getTime();
        return logTime === dayTime;
      });

      let eventType: 'period' | 'fertile' | 'ovulation' | 'logged' | 'none' = 'none';
      let source: 'logged' | 'predicted' | 'none' = 'none';

      // 1. Period matching logic
      if (log && log.flow !== 'none' && log.flow !== 'spotting') {
        eventType = 'period';
        source = 'logged';
      } else if (
        prediction &&
        dayTime >= new Date(prediction.next_period_start).getTime() &&
        dayTime <= new Date(prediction.next_period_end_estimate).getTime()
      ) {
        eventType = 'period';
        source = 'predicted';
      }
      // 2. Ovulation matching
      else if (prediction && dayTime === new Date(prediction.ovulation_estimate).getTime()) {
        eventType = 'ovulation';
        source = 'predicted';
      }
      // 3. Fertile window matching
      else if (
        prediction &&
        dayTime >= new Date(prediction.fertile_window_start).getTime() &&
        dayTime <= new Date(prediction.fertile_window_end).getTime()
      ) {
        eventType = 'fertile';
        source = 'predicted';
      }
      // 4. Logged stats fallback
      else if (log) {
        eventType = 'logged';
        source = 'logged';
      }

      if (eventType !== 'none') {
        events.push({
          date: dateStr,
          type: eventType,
          source,
          flow: log?.flow ?? 'none',
          mood: log?.mood ?? [],
          symptoms: log?.symptoms ?? [],
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({
      status: 'success',
      data: {
        events,
      },
    });
  } catch (error) {
    return next(error);
  }
};
