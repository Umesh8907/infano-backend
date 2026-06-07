import { getRedisClient, checkRedisConnection } from '../config/redis';
import UserProgress from '../models/UserProgress';
import User from '../models/User';
import { logger } from '../utils/logger';

export interface ILeaderboardRow {
  rank: number;
  display_name: string;
  avatar: string;
  total_xp: number;
}

/**
 * Updates a user's total XP inside the Redis leaderboard sorted sets
 */
export const updateUserLeaderboardXp = async (userId: string): Promise<void> => {
  try {
    // 1. Calculate user's total XP from UserProgress
    const progressDocs = await UserProgress.find({ user_id: userId }).exec();
    const totalXp = progressDocs.reduce((acc, p) => acc + p.total_xp_earned, 0);

    const isConnected = checkRedisConnection();
    const redis = getRedisClient();

    if (isConnected && redis) {
      // Update both all-time and weekly sorted sets
      // Weekly sorted set is named leaderboard:weekly, all-time is leaderboard:all_time
      await redis.zAdd('leaderboard:all_time', { score: totalXp, value: userId });
      await redis.zAdd('leaderboard:weekly', { score: totalXp, value: userId });
    }
  } catch (error: any) {
    logger.warn(`Failed to update user leaderboard XP in Redis: ${error.message}`);
  }
};

/**
 * Fetches the top users by XP
 */
export const getLeaderboard = async (
  type: 'weekly' | 'all_time' = 'all_time',
  limit: number = 50
): Promise<ILeaderboardRow[]> => {
  const isConnected = checkRedisConnection();
  const redis = getRedisClient();
  const key = `leaderboard:${type}`;

  if (isConnected && redis) {
    try {
      // Query Redis sorted set in reverse order (highest score first)
      const rawResults = await redis.zRangeWithScores(key, 0, limit - 1, { REV: true });
      
      if (rawResults.length > 0) {
        const userIds = rawResults.map(r => r.value);
        const users = await User.find({ _id: { $in: userIds } }).exec();
        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        return rawResults.map((r, idx) => {
          const user = userMap.get(r.value);
          return {
            rank: idx + 1,
            display_name: user?.name || 'Anonymous User',
            avatar: user?.avatar_url || '',
            total_xp: r.score
          };
        });
      }
    } catch (redisErr: any) {
      logger.warn(`Redis leaderboard fetch failed: ${redisErr.message}. Falling back to MongoDB.`);
    }
  }

  // Fallback to MongoDB aggregation query
  try {
    const results = await UserProgress.aggregate([
      {
        $group: {
          _id: '$user_id',
          total_xp: { $sum: '$total_xp_earned' }
        }
      },
      { $sort: { total_xp: -1 } },
      { $limit: limit }
    ]).exec();

    if (results.length === 0) return [];

    const userIds = results.map(r => r._id);
    const users = await User.find({ _id: { $in: userIds } }).exec();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    return results.map((r, idx) => {
      const user = userMap.get(r._id.toString());
      return {
        rank: idx + 1,
        display_name: user?.name || 'Anonymous User',
        avatar: user?.avatar_url || '',
        total_xp: r.total_xp
      };
    });
  } catch (mongoErr: any) {
    logger.error(`MongoDB leaderboard fallback query failed: ${mongoErr.message}`);
    throw mongoErr;
  }
};
