import { createClient } from 'redis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: REDIS_URL,
});

redisClient.on('error', (err) => {
  logger.warn(`Redis client error: ${err.message}`);
});

let isRedisConnected = false;

export const connectRedis = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test') {
    // Skip Redis in testing environment
    isRedisConnected = false;
    return;
  }
  
  try {
    await redisClient.connect();
    isRedisConnected = true;
    logger.info('Redis client connected successfully');
  } catch (error: any) {
    logger.warn(`Could not connect to Redis: ${error.message}. Running fallback mode.`);
    isRedisConnected = false;
  }
};

export const getRedisClient = () => {
  return isRedisConnected ? redisClient : null;
};

export const checkRedisConnection = (): boolean => {
  return isRedisConnected;
};
