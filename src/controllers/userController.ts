import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { NotFoundError } from '../utils/appError';
import { logger } from '../utils/logger';

/**
 * @desc    Update User Profile (Used for Onboarding and Settings)
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    logger.info(`req.user is: ${JSON.stringify(req.user)}`);
    const userId = req.user?.userId || (req.user as any)?.id || (req.user as any)?._id;
    
    if (!userId) {
      return next(new NotFoundError('User not found in request'));
    }

    const { name, age, onboarding_profile } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return next(new NotFoundError('User not found'));
    }

    // Update basic fields if provided
    if (name !== undefined) user.name = name;
    if (age !== undefined) user.age = age;

    // Update onboarding profile if provided
    if (onboarding_profile) {
      const {
        last_period_date,
        avg_cycle_length,
        avg_period_duration,
        health_conditions,
        birth_control_type,
        health_goals,
        onboarding_completed,
        tracker_setup_completed
      } = onboarding_profile;

      if (last_period_date !== undefined) user.onboarding_profile.last_period_date = new Date(last_period_date);
      if (avg_cycle_length !== undefined) user.onboarding_profile.avg_cycle_length = avg_cycle_length;
      if (avg_period_duration !== undefined) user.onboarding_profile.avg_period_duration = avg_period_duration;
      if (health_conditions !== undefined) user.onboarding_profile.health_conditions = health_conditions;
      if (birth_control_type !== undefined) user.onboarding_profile.birth_control_type = birth_control_type;
      if (health_goals !== undefined) user.onboarding_profile.health_goals = health_goals;
      
      // Update completion flags
      if (onboarding_completed !== undefined) {
        user.onboarding_profile.onboarding_completed = onboarding_completed;
        if (onboarding_completed && !user.onboarding_profile.completed_at) {
          user.onboarding_profile.completed_at = new Date();
        }
      }
      
      if (tracker_setup_completed !== undefined) {
        user.onboarding_profile.tracker_setup_completed = tracker_setup_completed;
      }
    }

    await user.save();

    logger.info(`User ${userId} updated their profile`);

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          name: user.name,
          age: user.age,
          avatar_url: user.avatar_url,
          tier: user.tier,
          onboarding_completed: user.onboarding_profile.onboarding_completed,
          tracker_setup_completed: user.onboarding_profile.tracker_setup_completed,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};
