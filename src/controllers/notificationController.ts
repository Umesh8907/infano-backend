import { Request, Response, NextFunction } from 'express';
import UserDevice from '../models/UserDevice';
import { ValidationError } from '../utils/appError';

/**
 * @desc    Register a new device token for push notifications
 * @route   POST /api/v1/notifications/devices
 * @access  Private
 */
export const registerDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const { device_token, platform } = req.body;

    // Use findOneAndUpdate to prevent duplicate tokens across users
    // If token exists, map it to the current active user
    await UserDevice.findOneAndUpdate(
      { device_token },
      { user_id: userId, platform },
      { upsert: true, new: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Device registered successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Deregister/remove a device token
 * @route   DELETE /api/v1/notifications/devices/:token
 * @access  Private
 */
export const deregisterDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const { token } = req.params;

    // Delete token mapped to the user to prevent unauthorized deletions
    const result = await UserDevice.deleteOne({ device_token: token, user_id: userId });

    res.status(200).json({
      status: 'success',
      message: result.deletedCount > 0 ? 'Device unregistered successfully' : 'Device token not found',
    });
  } catch (error) {
    return next(error);
  }
};
