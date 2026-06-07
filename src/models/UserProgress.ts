import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityProgress {
  activity_id: Types.ObjectId;
  status: 'not_started' | 'completed';
  completed_at?: Date;
  xp_awarded: number;
  response?: any;
}

export interface IEpisodeProgress {
  episode_id: Types.ObjectId;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  started_at?: Date;
  completed_at?: Date;
  xp_earned: number;
  activity_progress: IActivityProgress[];
  assessment_score?: number;
  assessment_attempts: number;
  last_assessment_attempt_at?: Date;
  certificate_url?: string;
}

export interface IUserProgress extends Document {
  user_id: Types.ObjectId;
  journey_id: Types.ObjectId;
  started_at: Date;
  completed_at?: Date;
  status: 'not_started' | 'in_progress' | 'completed';
  total_xp_earned: number;
  episode_progress: IEpisodeProgress[];
}

const ActivityProgressSchema = new Schema<IActivityProgress>({
  activity_id: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['not_started', 'completed'], default: 'not_started' },
  completed_at: { type: Date },
  xp_awarded: { type: Number, default: 0 },
  response: { type: Schema.Types.Mixed }
}, { _id: false });

const EpisodeProgressSchema = new Schema<IEpisodeProgress>({
  episode_id: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },
  status: { type: String, enum: ['locked', 'available', 'in_progress', 'completed'], default: 'locked' },
  started_at: { type: Date },
  completed_at: { type: Date },
  xp_earned: { type: Number, default: 0 },
  activity_progress: { type: [ActivityProgressSchema], default: [] },
  assessment_score: { type: Number },
  assessment_attempts: { type: Number, default: 0 },
  last_assessment_attempt_at: { type: Date },
  certificate_url: { type: String }
}, { _id: false });

const UserProgressSchema = new Schema<IUserProgress>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  journey_id: { type: Schema.Types.ObjectId, ref: 'Journey', required: true, index: true },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'in_progress' },
  total_xp_earned: { type: Number, default: 0 },
  episode_progress: { type: [EpisodeProgressSchema], default: [] }
});

// Compound unique index so user has at most one progress document per journey
UserProgressSchema.index({ user_id: 1, journey_id: 1 }, { unique: true });

export const UserProgress = model<IUserProgress>('UserProgress', UserProgressSchema);
export default UserProgress;
