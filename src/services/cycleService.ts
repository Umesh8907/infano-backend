import CycleRecord, { ICycleRecord } from '../models/CycleRecord';
import DailyLog, { IDailyLog } from '../models/DailyLog';
import { logger } from '../utils/logger';

/**
 * Re-evaluates and synchronizes CycleRecords based on DailyLogs for a specific user.
 * This is triggered whenever a daily log is added/modified with period_started=true or period_ended=true,
 * ensuring database state consistency and handling edge cases (e.g. retroactive logging, deletions).
 */
export const syncUserCyclesFromLogs = async (userId: string): Promise<void> => {
  logger.info(`Starting cycle record sync for user: ${userId}`);

  // 1. Fetch all daily logs where the user marked period starts or period ends, or logged flow.
  // Sort chronologically.
  const logs = await DailyLog.find({ user_id: userId })
    .sort({ date: 1 })
    .exec();

  // 2. Identify cycle boundaries.
  // In a clean, robust design:
  // - A cycle starts on a log where period_started === true OR (flow is light/medium/heavy and previous day had none/spotting/no log).
  // - A cycle ends when a log has period_ended === true OR flow transitions back to none/spotting for 2 consecutive days.
  
  const cycleStarts: Date[] = [];
  const cycleEnds = new Map<string, Date>(); // Keyed by start date string

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const prevLog = i > 0 ? logs[i - 1] : null;

    // Check start triggers
    let isStart = log.period_started;
    if (!isStart && log.flow !== 'none' && log.flow !== 'spotting') {
      const prevNoFlow = !prevLog || prevLog.flow === 'none' || prevLog.flow === 'spotting';
      if (prevNoFlow) {
        isStart = true;
      }
    }

    if (isStart) {
      const startDate = new Date(log.date);
      startDate.setUTCHours(0, 0, 0, 0);
      cycleStarts.push(startDate);
    }
  }

  // Filter duplicates (starts on same or consecutive days within a 3-day buffer to handle edge cases)
  const uniqueStarts: Date[] = [];
  for (const start of cycleStarts) {
    const isDuplicate = uniqueStarts.some(existing => {
      const diffTime = Math.abs(start.getTime() - existing.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= 3; // within 3 days
    });

    if (!isDuplicate) {
      uniqueStarts.push(start);
    }
  }

  // Find corresponding ends for each unique start
  for (let idx = 0; idx < uniqueStarts.length; idx++) {
    const start = uniqueStarts[idx];
    const nextStart = idx < uniqueStarts.length - 1 ? uniqueStarts[idx + 1] : null;

    // Look for period_ended === true or flow transition to none/spotting in logs between start and nextStart
    const cycleLogs = logs.filter(log => {
      const logTime = log.date.getTime();
      return logTime >= start.getTime() && (!nextStart || logTime < nextStart.getTime());
    });

    let endDate: Date | undefined;

    // Trigger 1: Look for explicit period_ended
    const explicitEndLog = cycleLogs.find(log => log.period_ended);
    if (explicitEndLog) {
      endDate = new Date(explicitEndLog.date);
    } else {
      // Trigger 2: Fallback to last day with active bleeding (light/medium/heavy)
      const bleedingLogs = cycleLogs.filter(log => log.flow !== 'none' && log.flow !== 'spotting');
      if (bleedingLogs.length > 0) {
        endDate = new Date(bleedingLogs[bleedingLogs.length - 1].date);
      }
    }

    if (endDate) {
      endDate.setUTCHours(0, 0, 0, 0);
      cycleEnds.set(start.toISOString(), endDate);
    }
  }

  // 3. Rebuild CycleRecord collections
  // Clean out existing records first to avoid duplicates or orphans during edits
  await CycleRecord.deleteMany({ user_id: userId }).exec();

  for (let idx = 0; idx < uniqueStarts.length; idx++) {
    const start = uniqueStarts[idx];
    const end = cycleEnds.get(start.toISOString());
    const nextStart = idx < uniqueStarts.length - 1 ? uniqueStarts[idx + 1] : null;

    // Cycle length = days between this start and next start
    let cycleLength: number | undefined;
    if (nextStart) {
      const diffTime = nextStart.getTime() - start.getTime();
      cycleLength = Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    // Period duration = days from start to end (inclusive, min 1 day)
    let periodDuration: number | undefined;
    if (end) {
      const diffTime = end.getTime() - start.getTime();
      periodDuration = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }

    // Aggregate symptoms logged during bleeding window
    const cycleLogs = logs.filter(log => {
      const logTime = log.date.getTime();
      return logTime >= start.getTime() && (!end || logTime <= end.getTime());
    });

    const symptomsSet = new Set<string>();
    let moodSum = 0;
    let energySum = 0;
    let scoreCount = 0;

    cycleLogs.forEach(log => {
      log.symptoms.forEach(s => symptomsSet.add(s));
      if (log.energy_level) {
        energySum += log.energy_level;
      }
      if (log.mood && log.mood.length > 0) {
        moodSum += log.mood.length; // placeholder metric
      }
      scoreCount++;
    });

    await CycleRecord.create({
      user_id: userId,
      period_start_date: start,
      period_end_date: end,
      cycle_length: cycleLength,
      period_duration: periodDuration,
      symptoms_during_period: Array.from(symptomsSet),
      avg_mood_score: scoreCount > 0 ? moodSum / scoreCount : undefined,
      avg_energy_score: scoreCount > 0 ? energySum / scoreCount : undefined,
    });
  }

  logger.info(`Rebuild complete: synchronized ${uniqueStarts.length} cycle records for user ${userId}`);
};
