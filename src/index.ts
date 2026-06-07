import dotenv from 'dotenv';
// Load environment variables before importing other files
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';
import authRoutes from './routes/authRoutes';
import healthRoutes from './routes/healthRoutes';
import communityRoutes from './routes/communityRoutes';
import gigiRoutes from './routes/gigiRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import notificationRoutes from './routes/notificationRoutes';
import learningRoutes from './routes/learningRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { protect, restrictTo } from './middlewares/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Security: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'error',
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Configure CORS
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply standard global middlewares
app.use(cors(corsOptions));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1/gigi', gigiRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/learning', learningRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    timestamp: new Date(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

// Example protected endpoint to test Auth validation & Tier constraints
app.get('/api/v1/test-premium', protect, restrictTo('plus', 'pro'), (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'You have accessed premium resources!',
    user: req.user,
  });
});

// Standard Error Handler (must be bound last)
app.use(errorHandler);

// Connect database and run listener
const startServer = async () => {
  await connectDB();
  await connectRedis();
  
  const server = app.listen(PORT, () => {
    logger.info(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Handle uncaught operational failures gracefully
  process.on('unhandledRejection', (err: any) => {
    logger.error(`UNHANDLED REJECTION: ${err.message}. Shutting down server...`);
    server.close(() => {
      process.exit(1);
    });
  });
};

// Handle process termination cleanly
process.on('uncaughtException', (err: Error) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.message}. Shutting down process immediately...`);
  process.exit(1);
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
