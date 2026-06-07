import { Schema, model, Document, Types } from 'mongoose';

export interface IUserBadge extends Document {
  user_id: Types.ObjectId;
  badge_id: Types.ObjectId;
  awarded_at: Date;
  source: string; // e.g. 'journey:journeyId' or 'episode:episodeId' or 'streak:30'
}

const UserBadgeSchema = new Schema<IUserBadge>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  badge_id: { type: Schema.Types.ObjectId, ref: 'Badge', required: true, index: true },
  awarded_at: { type: Date, default: Date.now },
  source: { type: String, required: true }
});

// Ensure a user gets a specific badge for a specific source only once (compound unique index)
UserBadgeSchema.index({ user_id: 1, badge_id: 1, source: 1 }, { unique: true });

export const UserBadge = model<IUserBadge>('UserBadge', UserBadgeSchema);
export default UserBadge;
