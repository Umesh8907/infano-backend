import { Schema, model, Document } from 'mongoose';

export interface IOnboardingProfile {
  last_period_date?: Date;
  avg_cycle_length: number;
  avg_period_duration: number;
  health_conditions: string[];
  birth_control_type: string;
  health_goals: string[];
  onboarding_completed: boolean;
  tracker_setup_completed: boolean;
  completed_at?: Date;
}

export interface INotificationPreferences {
  period_reminder: boolean;
  daily_log_reminder: boolean;
  reminder_time: string;
  insights_weekly: boolean;
}

export interface IUser extends Document {
  name?: string;
  phone: string; // Unique primary identity
  age?: number;
  avatar_url?: string;
  tier: 'free' | 'plus' | 'pro';
  subscription_id?: string;
  valid_until?: Date;
  onboarding_profile: IOnboardingProfile;
  notification_preferences: INotificationPreferences;
  created_at: Date;
  updated_at: Date;
  last_active: Date;
}

const OnboardingProfileSchema = new Schema<IOnboardingProfile>({
  last_period_date: { type: Date },
  avg_cycle_length: { type: Number, default: 28 },
  avg_period_duration: { type: Number, default: 5 },
  health_conditions: { type: [String], default: [] },
  birth_control_type: { type: String, default: 'none' },
  health_goals: { type: [String], default: [] },
  onboarding_completed: { type: Boolean, default: false },
  tracker_setup_completed: { type: Boolean, default: false },
  completed_at: { type: Date },
}, { _id: false });

const NotificationPreferencesSchema = new Schema<INotificationPreferences>({
  period_reminder: { type: Boolean, default: true },
  daily_log_reminder: { type: Boolean, default: true },
  reminder_time: { type: String, default: '09:00' },
  insights_weekly: { type: Boolean, default: true },
}, { _id: false });

const UserSchema = new Schema<IUser>({
  name: { type: String, trim: true },
  phone: { type: String, required: true, unique: true, index: true },
  age: { type: Number },
  avatar_url: { type: String },
  tier: { type: String, enum: ['free', 'plus', 'pro'], default: 'free' },
  subscription_id: { type: String },
  valid_until: { type: Date },
  onboarding_profile: { type: OnboardingProfileSchema, default: () => ({}) },
  notification_preferences: { type: NotificationPreferencesSchema, default: () => ({}) },
  last_active: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const User = model<IUser>('User', UserSchema);
export default User;
