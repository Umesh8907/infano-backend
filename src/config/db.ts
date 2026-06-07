import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/infano';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    logger.info(`MongoDB connected successfully: ${conn.connection.host}`);
  } catch (error: any) {
    logger.error(`Database connection failure: ${error.message}`);
    process.exit(1);
  }
};
