import { createClient } from 'redis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: false, // Do not auto-reconnect if it fails
  }
});

redisClient.on('error', (err) => {
  // Suppress verbose reconnect errors to prevent console spam when Redis is offline.
  // The initial connection failure is cleanly caught and logged by connectRedis().
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
