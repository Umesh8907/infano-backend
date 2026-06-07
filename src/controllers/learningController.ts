import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Journey from '../models/Journey';
import Episode from '../models/Episode';
import UserProgress from '../models/UserProgress';
import Badge from '../models/Badge';
import UserBadge from '../models/UserBadge';
import User from '../models/User';
import DailyLog from '../models/DailyLog';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/appError';
import { updateUserLeaderboardXp, getLeaderboard as fetchLeaderboard } from '../services/leaderboardService';

/**
 * Calculates logging streak based on user's DailyLog history
 */
const calculateLoggingStreak = async (userId: string): Promise<number> => {
  const logs = await DailyLog.find({ user_id: userId })
    .sort({ date: -1 })
    .exec();

  if (logs.length === 0) return 0;

  // Normalize dates to YYYY-MM-DD in UTC
  const loggedDates = new Set(logs.map(log => {
    const d = new Date(log.date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }));

  const getLocalDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = getLocalDateString(today);
  const yesterdayStr = getLocalDateString(yesterday);

  let checkDate = new Date();

  // If logged today, streak starts today. If not logged today but logged yesterday, streak starts yesterday.
  // If neither, streak is 0.
  if (loggedDates.has(todayStr)) {
    // Start from today
  } else if (loggedDates.has(yesterdayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    return 0;
  }

  let currentStreak = 0;
  while (true) {
    const checkStr = getLocalDateString(checkDate);
    if (loggedDates.has(checkStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1); // Go back 1 day
    } else {
      break;
    }
  }

  return currentStreak;
};

/**
 * Helper to determine if an episode is locked for a free tier user
 */
const isEpisodeLockedByTier = (userTier: 'free' | 'plus' | 'pro', episode: any): boolean => {
  if (userTier !== 'free') return false; // Premium users have all unlocked
  return !episode.is_free; // If free tier, only free episodes are allowed
};

/**
 * @desc    Get all published journeys with user progress summaries
 * @route   GET /api/v1/learning/journeys
 * @access  Private
 */
export const getJourneys = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const { category, tier } = req.query;
    const filter: any = { status: 'published' };

    if (category) filter.category = category;
    if (tier) filter.tier_required = tier;

    const journeys = await Journey.find(filter).sort({ created_at: -1 }).exec();
    const userTier = req.user?.tier || 'free';

    const results = await Promise.all(journeys.map(async (journey) => {
      const progress = await UserProgress.findOne({ user_id: userId, journey_id: journey._id }).exec();
      
      let completedEpisodes = 0;
      if (progress) {
        completedEpisodes = progress.episode_progress.filter(ep => ep.status === 'completed').length;
      }

      // Check if journey is completely locked by tier (i.e. user is free and journey is premium)
      // Note: Free users can still view the first 2 episodes even of premium journeys if overrides exist.
      const isLockedByTier = userTier === 'free' && journey.tier_required !== 'free';

      return {
        journey,
        user_progress_summary: {
          status: progress ? progress.status : 'not_started',
          total_xp_earned: progress ? progress.total_xp_earned : 0,
          completed_episodes: completedEpisodes,
          total_episodes: journey.episode_ids.length,
          is_locked: isLockedByTier
        }
      };
    }));

    res.status(200).json({
      status: 'success',
      data: results
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get detailed journey with episodes and user lock/completion statuses
 * @route   GET /api/v1/learning/journeys/:journeyId
 * @access  Private
 */
export const getJourneyDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier || 'free';
    const { journeyId } = req.params;

    const journey = await Journey.findById(journeyId).exec();
    if (!journey || journey.status !== 'published') {
      return next(new NotFoundError('Journey not found'));
    }

    const episodes = await Episode.find({ journey_id: journeyId, status: 'published' })
      .sort({ order: 1 })
      .exec();

    const progress = await UserProgress.findOne({ user_id: userId, journey_id: journeyId }).exec();

    const episodeResults = episodes.map((ep, idx) => {
      let status: 'locked' | 'available' | 'in_progress' | 'completed' = 'locked';
      let lockedReason: 'previous_episode_incomplete' | 'requires_upgrade' | null = null;

      const progressEntry = progress?.episode_progress.find(p => p.episode_id.toString() === ep._id.toString());

      if (progressEntry) {
        status = progressEntry.status;
      } else {
        // If no progress entry exists yet, check unlocking conditions:
        // First episode (order: 1) is unlocked by default
        if (ep.order === 1) {
          status = 'available';
        } else {
          // Check if previous episode is completed in user's progress
          const prevEp = episodes[idx - 1];
          const prevProgress = progress?.episode_progress.find(p => p.episode_id.toString() === prevEp?._id.toString());
          if (prevProgress && prevProgress.status === 'completed') {
            status = 'available';
          } else {
            status = 'locked';
            lockedReason = 'previous_episode_incomplete';
          }
        }
      }

      // Check premium restrictions
      if (isEpisodeLockedByTier(userTier, ep)) {
        status = 'locked';
        lockedReason = 'requires_upgrade';
      }

      return {
        episode: ep,
        status,
        locked_reason: lockedReason
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        journey,
        episodes: episodeResults
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get full episode details including activities (checks lock status)
 * @route   GET /api/v1/learning/episodes/:episodeId
 * @access  Private
 */
export const getEpisodeDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier || 'free';
    const { episodeId } = req.params;

    const episode = await Episode.findById(episodeId).exec();
    if (!episode || episode.status !== 'published') {
      return next(new NotFoundError('Episode not found'));
    }

    // Gating check: Retrieve all episodes of the journey to verify sequence lock
    const journeyEpisodes = await Episode.find({ journey_id: episode.journey_id, status: 'published' })
      .sort({ order: 1 })
      .exec();

    const progress = await UserProgress.findOne({ user_id: userId, journey_id: episode.journey_id }).exec();
    const episodeIndex = journeyEpisodes.findIndex(e => e._id.toString() === episode._id.toString());

    let isLocked = false;
    let lockedReason: 'previous_episode_incomplete' | 'requires_upgrade' | null = null;

    if (episode.order > 1) {
      const prevEp = journeyEpisodes[episodeIndex - 1];
      const prevProgress = progress?.episode_progress.find(p => p.episode_id.toString() === prevEp?._id.toString());
      if (!prevProgress || prevProgress.status !== 'completed') {
        isLocked = true;
        lockedReason = 'previous_episode_incomplete';
      }
    }

    // Gating check: Tier validation
    if (isEpisodeLockedByTier(userTier, episode)) {
      isLocked = true;
      lockedReason = 'requires_upgrade';
    }

    if (isLocked) {
      return next(new ForbiddenError(`Episode is locked: ${lockedReason}`));
    }

    const progressEntry = progress?.episode_progress.find(p => p.episode_id.toString() === episode._id.toString());

    res.status(200).json({
      status: 'success',
      data: {
        episode,
        activities: episode.activities,
        user_activity_progress: progressEntry ? progressEntry.activity_progress : []
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Start learning journey and initialize user progress sub-documents
 * @route   POST /api/v1/learning/progress/start-journey
 * @access  Private
 */
export const startJourney = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const { journey_id } = req.body;

    const journey = await Journey.findById(journey_id).exec();
    if (!journey || journey.status !== 'published') {
      return next(new NotFoundError('Journey not found'));
    }

    let progress = await UserProgress.findOne({ user_id: userId, journey_id }).exec();
    const episodes = await Episode.find({ journey_id, status: 'published' }).sort({ order: 1 }).exec();

    if (!progress) {
      const episodeProgressList = episodes.map((ep) => {
        const activityProgressList = ep.activities.map((act) => ({
          activity_id: act._id,
          status: 'not_started' as const,
          xp_awarded: 0
        }));

        return {
          episode_id: ep._id as Types.ObjectId,
          status: ep.order === 1 ? 'available' as const : 'locked' as const,
          xp_earned: 0,
          activity_progress: activityProgressList,
          assessment_attempts: 0
        };
      });

      progress = await UserProgress.create({
        user_id: userId,
        journey_id,
        status: 'in_progress',
        total_xp_earned: 0,
        episode_progress: episodeProgressList
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        progress_id: progress._id,
        first_episode_id: episodes[0]?._id
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Complete an activity inside an episode, validate logic, distribute XP, and unlock next steps
 * @route   POST /api/v1/learning/progress/complete-activity
 * @access  Private
 */
export const completeActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier || 'free';
    if (!userId) return next(new ValidationError('Auth required'));

    const { episode_id, activity_id, response } = req.body;

    const episode = await Episode.findById(episode_id).exec();
    if (!episode || episode.status !== 'published') {
      return next(new NotFoundError('Episode not found'));
    }

    const journey = await Journey.findById(episode.journey_id).exec();
    if (!journey) {
      return next(new NotFoundError('Journey not found'));
    }

    // Retrieve or auto-start progress if user has not explicitly clicked start
    let progress = await UserProgress.findOne({ user_id: userId, journey_id: journey._id }).exec();
    const episodes = await Episode.find({ journey_id: journey._id, status: 'published' }).sort({ order: 1 }).exec();

    if (!progress) {
      const episodeProgressList = episodes.map((ep) => {
        const activityProgressList = ep.activities.map((act) => ({
          activity_id: act._id,
          status: 'not_started' as const,
          xp_awarded: 0
        }));

        return {
          episode_id: ep._id as Types.ObjectId,
          status: ep.order === 1 ? 'available' as const : 'locked' as const,
          xp_earned: 0,
          activity_progress: activityProgressList,
          assessment_attempts: 0
        };
      });

      progress = await UserProgress.create({
        user_id: userId,
        journey_id: journey._id,
        status: 'in_progress',
        total_xp_earned: 0,
        episode_progress: episodeProgressList
      });
    }

    const epProgress = progress.episode_progress.find(p => p.episode_id.toString() === episode_id);
    if (!epProgress) {
      return next(new ValidationError('Episode progress entry not found'));
    }

    // Sequence check: Cannot complete activities in locked episodes
    // We enforce tier lock check too
    const isLocked = epProgress.status === 'locked' || isEpisodeLockedByTier(userTier, episode);
    if (isLocked) {
      return next(new ForbiddenError('This episode is locked (requires previous completion or premium upgrade)'));
    }

    const activity = episode.activities.find(act => act._id.toString() === activity_id);
    if (!activity) {
      return next(new NotFoundError('Activity not found in this episode'));
    }

    let actProgress = epProgress.activity_progress.find(p => p.activity_id.toString() === activity_id);
    if (!actProgress) {
      // Initialize activity progress if it wasn't populated
      actProgress = {
        activity_id: activity._id,
        status: 'not_started',
        xp_awarded: 0
      };
      epProgress.activity_progress.push(actProgress);
    }

    // If already completed, just return success with zero additional XP
    if (actProgress.status === 'completed') {
      res.status(200).json({
        status: 'success',
        data: {
          xp_awarded: 0,
          episode_completed: epProgress.status === 'completed',
          passed: true
        }
      });
      return;
    }

    // Process specific validations based on activity types
    let passed = true;
    let score = 1;

    if (activity.type === 'assessment') {
      // 30-second assessment cooldown check
      if (epProgress.last_assessment_attempt_at) {
        const secondsSinceLast = (Date.now() - new Date(epProgress.last_assessment_attempt_at).getTime()) / 1000;
        if (secondsSinceLast < 30) {
          return next(new ForbiddenError('Assessment cooldown active. Please wait 30 seconds before retrying.'));
        }
      }

      epProgress.last_assessment_attempt_at = new Date();
      epProgress.assessment_attempts = (epProgress.assessment_attempts || 0) + 1;

      // Validate answers
      const questions = activity.payload.questions || [];
      const userAnswers = response?.answers || [];
      let correctCount = 0;

      questions.forEach((q: any, index: number) => {
        if (userAnswers[index] === q.correct_index) {
          correctCount++;
        }
      });

      score = questions.length > 0 ? correctCount / questions.length : 1;
      epProgress.assessment_score = score;

      const threshold = activity.payload.pass_threshold || episode.pass_threshold || 0.70;
      if (score < threshold) {
        passed = false;
        await progress.save();
        res.status(200).json({
          status: 'success',
          data: {
            xp_awarded: 0,
            episode_completed: false,
            passed: false,
            score,
            attempts: epProgress.assessment_attempts
          }
        });
        return;
      }
    } else if (activity.type === 'journal_entry') {
      if (!response || typeof response !== 'string' || response.trim().length === 0) {
        return next(new ValidationError('Journal entry response must be a non-empty string'));
      }
    }

    // Award XP and mark activity completed
    actProgress.status = 'completed';
    actProgress.completed_at = new Date();
    actProgress.xp_awarded = activity.xp_value;
    actProgress.response = response;

    epProgress.xp_earned += activity.xp_value;
    progress.total_xp_earned += activity.xp_value;

    // Check if all required activities are now completed
    const requiredActIds = episode.activities.filter(a => a.is_required !== false).map(a => a._id.toString());
    const completedActIds = epProgress.activity_progress.filter(ap => ap.status === 'completed').map(ap => ap.activity_id.toString());
    const allRequiredCompleted = requiredActIds.every(id => completedActIds.includes(id));

    let episodeCompleted = false;
    let nextEpisodeId = null;
    let badgeAwarded = null;

    if (allRequiredCompleted) {
      epProgress.status = 'completed';
      epProgress.completed_at = new Date();
      episodeCompleted = true;

      // Unlock next episode
      const nextEp = episodes.find(e => e.order === episode.order + 1);
      if (nextEp) {
        nextEpisodeId = nextEp._id;
        const nextProgress = progress.episode_progress.find(p => p.episode_id.toString() === nextEp._id.toString());
        if (nextProgress && nextProgress.status === 'locked') {
          nextProgress.status = 'available';
          nextProgress.started_at = new Date();
        }
      } else {
        // No next episode -> Journey is completed!
        progress.status = 'completed';
        progress.completed_at = new Date();

        // Award completion badge if defined
        if (journey.completion_badge_id) {
          try {
            const badge = await Badge.findById(journey.completion_badge_id).exec();
            if (badge) {
              await UserBadge.findOneAndUpdate(
                { user_id: userId, badge_id: badge._id, source: `journey:${journey._id}` },
                { awarded_at: new Date() },
                { upsert: true }
              );
              badgeAwarded = badge;
            }
          } catch (badgeErr: any) {
            // Log badge error but don't break main progression flow
            console.error(`Error awarding completion badge: ${badgeErr.message}`);
          }
        }
      }
    } else {
      epProgress.status = 'in_progress';
      if (!epProgress.started_at) {
        epProgress.started_at = new Date();
      }
    }

    await progress.save();

    // Trigger asynchronous leaderboard update
    updateUserLeaderboardXp(userId).catch(err => {
      console.error(`Leaderboard background update error: ${err.message}`);
    });

    res.status(200).json({
      status: 'success',
      data: {
        xp_awarded: activity.xp_value,
        episode_completed: episodeCompleted,
        next_episode_id: nextEpisodeId,
        badge_awarded: badgeAwarded,
        passed,
        score
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get detailed progress for a specific journey
 * @route   GET /api/v1/learning/progress/journey/:journeyId
 * @access  Private
 */
export const getJourneyProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { journeyId } = req.params;

    const progress = await UserProgress.findOne({ user_id: userId, journey_id: journeyId }).exec();
    if (!progress) {
      return next(new NotFoundError('No progress found for this journey'));
    }

    res.status(200).json({
      status: 'success',
      data: progress
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get user's overall learning summary stats (Total XP, Streak, Badges, etc.)
 * @route   GET /api/v1/learning/progress/summary
 * @access  Private
 */
export const getLearningSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const allProgress = await UserProgress.find({ user_id: userId }).exec();
    const totalXp = allProgress.reduce((acc, p) => acc + p.total_xp_earned, 0);
    const journeysCompleted = allProgress.filter(p => p.status === 'completed').length;
    
    const badgesCount = await UserBadge.countDocuments({ user_id: userId }).exec();
    const currentStreak = await calculateLoggingStreak(userId);

    res.status(200).json({
      status: 'success',
      data: {
        total_xp: totalXp,
        journeys_completed: journeysCompleted,
        badges_count: badgesCount,
        current_streak: currentStreak
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get user's earned badges list
 * @route   GET /api/v1/learning/badges/mine
 * @access  Private
 */
export const getUserBadges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const userBadges = await UserBadge.find({ user_id: userId })
      .populate('badge_id')
      .exec();

    // Map into clean results: [{ badge, awarded_at }]
    const results = userBadges.map((ub: any) => ({
      badge: ub.badge_id,
      awarded_at: ub.awarded_at
    }));

    res.status(200).json({
      status: 'success',
      data: {
        badges: results
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get top 50 users by total XP (Plus/Pro tier only)
 * @route   GET /api/v1/learning/leaderboard
 * @access  Private (Plus/Pro)
 */
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userTier = req.user?.tier || 'free';
    
    // Gating check: Plus/Pro tier restriction
    if (userTier === 'free') {
      return next(new ForbiddenError('Access to leaderboard requires an upgrade'));
    }

    const leaderboard = await fetchLeaderboard('all_time', 50);

    res.status(200).json({
      status: 'success',
      data: {
        leaderboard
      }
    });
  } catch (error) {
    return next(error);
  }
};
