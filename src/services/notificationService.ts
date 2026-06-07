import UserDevice from '../models/UserDevice';
import User from '../models/User';
import DailyLog from '../models/DailyLog';
import { logger } from '../utils/logger';

// Optionally import firebase-admin if needed in production
// import admin from 'firebase-admin';

/**
 * Sends a push notification to all devices registered for a user.
 * If credentials are not present, it logs a trace to backend logs.
 */
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> => {
  try {
    const devices = await UserDevice.find({ user_id: userId }).exec();
    if (devices.length === 0) {
      logger.info(`No devices registered for user ${userId}. Skipping push notification.`);
      return 0;
    }

    const tokens = devices.map(d => d.device_token);

    logger.info(
      `[PUSH NOTIFICATION] User=${userId} DevicesCount=${devices.length} Title="${title}" Body="${body}" Data=${JSON.stringify(
        data || {}
      )}`
    );

    // Mock Dispatch Loop:
    // In production, you would run:
    // const message = { notification: { title, body }, data, tokens };
    // const response = await admin.messaging().sendEachForMulticast(message);
    // And clean up unregistered/invalid tokens from database.
    
    tokens.forEach(token => {
      logger.debug(`Sending mock FCM payload to device_token=${token}`);
    });

    return tokens.length;
  } catch (error: any) {
    logger.error(`Failed to send push notification to user ${userId}: ${error.message}`);
    return 0;
  }
};

/**
 * Scans all active users and dispatches reminders to log their health tracker logs for today.
 */
export const sendDailyLogReminders = async (): Promise<number> => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get all users who have daily_log_reminder enabled
    const users = await User.find({
      'notification_preferences.daily_log_reminder': true,
    }).exec();

    logger.info(`Running daily log reminders. Scanning ${users.length} users...`);

    let reminderCount = 0;

    for (const user of users) {
      // Check if user already has a log for today
      const logExists = await DailyLog.findOne({
        user_id: user._id,
        date: today,
      }).exec();

      if (!logExists) {
        // Send reminder
        const title = 'Time for self-care! 🌸';
        const nameGreeting = user.name ? `, ${user.name}` : '';
        const body = `Hi${nameGreeting}, take 1 minute to check in and log your mood and symptoms for today.`;
        
        await sendPushNotification(user._id.toString(), title, body, {
          action: 'open_daily_log',
        });
        
        reminderCount++;
      }
    }

    logger.info(`Completed daily log reminders. Dispatched ${reminderCount} notifications.`);
    return reminderCount;
  } catch (error: any) {
    logger.error(`Failed to run daily log reminders job: ${error.message}`);
    return 0;
  }
};
