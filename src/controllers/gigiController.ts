import { Request, Response, NextFunction } from 'express';
import GigiSession from '../models/GigiSession';
import GigiMessage from '../models/GigiMessage';
import GigiDailyUsage from '../models/GigiDailyUsage';
import CyclePrediction from '../models/CyclePrediction';
import User from '../models/User';
import {
  classifyQuerySafety,
  SAFETY_RESPONSES,
  streamGigiResponse,
} from '../services/gigiService';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/appError';
import { logger } from '../utils/logger';

/**
 * Normalizes date to midnight UTC
 */
const getTodayDate = (): Date => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/**
 * @desc    Submit user message and stream assistant response (SSE stream)
 * @route   POST /api/v1/gigi/message
 * @access  Private
 */
export const postMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier;

    if (!userId || !userTier) return next(new ValidationError('Auth required'));

    const { content, session_id } = req.body;
    const today = getTodayDate();

    // 1. Enforce Free Tier Daily Quota (5 messages/day)
    let dailyUsage = await GigiDailyUsage.findOne({ user_id: userId, date: today });
    if (!dailyUsage) {
      dailyUsage = await GigiDailyUsage.create({ user_id: userId, date: today, message_count: 0 });
    }

    if (userTier === 'free' && dailyUsage.message_count >= 5) {
      res.status(429).json({
        status: 'error',
        code: 'DAILY_LIMIT_EXCEEDED',
        message: 'You have hit your daily limit of 5 messages. Upgrade to Infano Plus for unlimited chat!',
      });
      return;
    }

    // 2. Safety screening check
    const safetyStatus = classifyQuerySafety(content);
    if (safetyStatus !== 'safe') {
      // Return hardcoded safety response immediately
      const safetyReply = SAFETY_RESPONSES[safetyStatus];
      
      // Increment usage count
      dailyUsage.message_count += 1;
      await dailyUsage.save();

      res.status(200).json({
        status: 'success',
        content: safetyReply,
        safety_flagged: true,
      });
      return;
    }

    // 3. Resolve or initialize session context
    let session;
    if (session_id) {
      session = await GigiSession.findById(session_id);
    }

    // Fetch user details for age groups
    const userObj = await User.findById(userId);
    if (!userObj) return next(new NotFoundError('User not found'));

    const userAge = userObj.age;
    const ageGroup = userAge && userAge < 18 ? 'adolescent' : 'adult';

    // Fetch latest predictions for cycle context
    const prediction = await CyclePrediction.findOne({ user_id: userId });

    if (!session) {
      session = await GigiSession.create({
        user_id: userId,
        session_context: {
          cycle_day: prediction?.cycle_day_today,
          cycle_phase: prediction?.cycle_phase_today,
          health_conditions: userObj.onboarding_profile?.health_conditions || [],
          age_group: ageGroup,
        },
      });
    } else {
      // Sync latest context variables
      session.session_context.cycle_day = prediction?.cycle_day_today || session.session_context.cycle_day;
      session.session_context.cycle_phase = prediction?.cycle_phase_today || session.session_context.cycle_phase;
      session.session_context.health_conditions = userObj.onboarding_profile?.health_conditions || [];
      await session.save();
    }

    // Save user message in DB
    const userMessageObj = await GigiMessage.create({
      session_id: session._id,
      user_id: userId,
      role: 'user',
      content,
    });

    // Fetch last 10 messages from history to maintain context
    const messageHistory = await GigiMessage.find({ session_id: session._id })
      .sort({ created_at: -1 })
      .limit(11) // includes current message, so fetch 11
      .exec();

    // Reverse history back to chronological order (assistant requires user first)
    const formattedHistory = messageHistory
      .reverse()
      .slice(0, -1) // exclude latest message
      .map(msg => ({ role: msg.role, content: msg.content }));

    // Set Server-Sent Events headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Establish connection immediately

    let assistantResponseText = '';
    const startTime = Date.now();

    // Invoke streaming response
    const streamResult = await streamGigiResponse(
      session,
      content,
      formattedHistory,
      (chunk) => {
        // SSE standard format data line
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        assistantResponseText += chunk;
      }
    );

    const latency = Date.now() - startTime;

    // Save assistant message in DB
    const assistantMessageObj = await GigiMessage.create({
      session_id: session._id,
      user_id: userId,
      role: 'assistant',
      content: assistantResponseText,
      model_used: streamResult.model,
      latency_ms: latency,
    });

    // Update session stats
    session.message_count += 2; // User message + Assistant reply
    session.last_message_at = new Date();
    await session.save();

    // Increment daily usage
    dailyUsage.message_count += 1;
    await dailyUsage.save();

    // SSE close connection packet
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get recent sessions list (limit 20)
 * @route   GET /api/v1/gigi/sessions
 * @access  Private
 */
export const getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const sessions = await GigiSession.find({ user_id: userId })
      .sort({ last_message_at: -1 })
      .limit(20)
      .exec();

    res.status(200).json({
      status: 'success',
      data: {
        sessions,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get message history of a specific session (Plus/Pro tier only)
 * @route   GET /api/v1/gigi/sessions/:sessionId/messages
 * @access  Private
 */
export const getSessionMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier;
    const { sessionId } = req.params;

    if (!userId || !userTier) return next(new ValidationError('Auth required'));

    // Gated history review: free tier can only see current session, no history retrieval
    if (userTier === 'free') {
      return next(new ForbiddenError('Chat history is limited to Plus and Pro members. Please upgrade.'));
    }

    const session = await GigiSession.findById(sessionId);
    if (!session || session.user_id.toString() !== userId) {
      return next(new NotFoundError('Session not found'));
    }

    const messages = await GigiMessage.find({ session_id: sessionId })
      .sort({ created_at: 1 })
      .exec();

    res.status(200).json({
      status: 'success',
      data: {
        messages,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Submit message feedback (positive/negative)
 * @route   POST /api/v1/gigi/messages/:messageId/feedback
 * @access  Private
 */
export const postMessageFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;
    const { feedback } = req.body;

    if (!userId) return next(new ValidationError('Auth required'));

    const message = await GigiMessage.findById(messageId);
    if (!message || message.user_id.toString() !== userId) {
      return next(new NotFoundError('Message not found'));
    }

    message.feedback = feedback;
    await message.save();

    res.status(200).json({
      status: 'success',
      message: 'Feedback recorded successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Flag message for moderation review
 * @route   POST /api/v1/gigi/messages/:messageId/flag
 * @access  Private
 */
export const flagMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { messageId } = req.params;
    const { reason } = req.body;

    if (!userId) return next(new ValidationError('Auth required'));

    const message = await GigiMessage.findById(messageId);
    if (!message || message.user_id.toString() !== userId) {
      return next(new NotFoundError('Message not found'));
    }

    message.flagged = true;
    message.flag_reason = reason;
    await message.save();

    res.status(200).json({
      status: 'success',
      message: 'Message flagged successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get daily usage metrics
 * @route   GET /api/v1/gigi/usage/today
 * @access  Private
 */
export const getTodayUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier;

    if (!userId || !userTier) return next(new ValidationError('Auth required'));

    const today = getTodayDate();
    const usage = await GigiDailyUsage.findOne({ user_id: userId, date: today });

    const used = usage?.message_count ?? 0;
    const isUnlimited = userTier !== 'free';
    const limit = isUnlimited ? null : 5;

    res.status(200).json({
      status: 'success',
      data: {
        used,
        limit,
        is_unlimited: isUnlimited,
      },
    });
  } catch (error) {
    return next(error);
  }
};
