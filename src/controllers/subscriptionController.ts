import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import { ValidationError, NotFoundError } from '../utils/appError';
import { logger } from '../utils/logger';

/**
 * @desc    Handle Razorpay subscription webhooks
 * @route   POST /api/v1/subscriptions/razorpay/webhook
 * @access  Public
 */
export const handleRazorpayWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return next(new ValidationError('Missing signature header'));
    }

    if (!webhookSecret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET is not configured in environment');
      res.status(500).json({ status: 'error', message: 'Webhook secret not configured' });
      return;
    }

    // Verify signature using raw request body
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      logger.warn('Razorpay webhook signature verification failed');
      res.status(400).json({ status: 'error', message: 'Invalid webhook signature' });
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload;

    logger.info(`Processing Razorpay webhook event: ${event}`);

    if (!payload || !payload.subscription) {
      res.status(200).json({ status: 'success', message: 'Ignored: no subscription payload' });
      return;
    }

    const subEntity = payload.subscription.entity;
    const subscriptionId = subEntity.id;
    const status = subEntity.status;
    const notes = subEntity.notes || {};
    const userId = notes.user_id;

    // Resolve user by notes.user_id or subscription_id
    let user;
    if (userId) {
      user = await User.findById(userId);
    }
    if (!user && subscriptionId) {
      user = await User.findOne({ subscription_id: subscriptionId });
    }

    if (!user) {
      logger.warn(`User not found for subscription webhook: user_id=${userId}, subscription_id=${subscriptionId}`);
      res.status(200).json({ status: 'success', message: 'User not found, webhook ignored' });
      return;
    }

    // Process event types
    if (event === 'subscription.activated' || event === 'subscription.charged') {
      const targetTier = notes.tier === 'pro' ? 'pro' : 'plus'; // Default to premium 'plus'
      const currentEnd = subEntity.current_end; // Unix timestamp
      const expiryDate = currentEnd ? new Date(currentEnd * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      user.tier = targetTier;
      user.subscription_id = subscriptionId;
      user.valid_until = expiryDate;
      await user.save();

      logger.info(`User ${user._id} subscription updated to tier=${targetTier} until ${expiryDate}`);
    } else if (
      event === 'subscription.cancelled' ||
      event === 'subscription.halted' ||
      event === 'subscription.charged_failed'
    ) {
      // Downgrade user to free tier on cancel/halt
      user.tier = 'free';
      user.valid_until = new Date(); // expired immediately
      await user.save();

      logger.info(`User ${user._id} subscription deactivated. Downgraded to free tier.`);
    }

    res.status(200).json({
      status: 'success',
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    return next(error);
  }
};
