import { Schema, model, Document, Types } from 'mongoose';

export type UserCommunityTrustLevel = 'new' | 'regular' | 'trusted' | 'creator';

export interface IUserCommunityStats extends Document {
  user_id: Types.ObjectId;
  post_count: number;
  comment_count: number;
  reactions_received: number;
  trust_level: UserCommunityTrustLevel;
  is_banned: boolean;
  ban_expires_at?: Date;
  violation_count: number;
  followed_spaces: Types.ObjectId[];
  updated_at: Date;
}

const UserCommunityStatsSchema = new Schema<IUserCommunityStats>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  post_count: { type: Number, default: 0 },
  comment_count: { type: Number, default: 0 },
  reactions_received: { type: Number, default: 0 },
  trust_level: { 
    type: String, 
    enum: ['new', 'regular', 'trusted', 'creator'], 
    default: 'new' 
  },
  is_banned: { type: Boolean, default: false },
  ban_expires_at: { type: Date },
  violation_count: { type: Number, default: 0 },
  followed_spaces: { type: [Schema.Types.ObjectId], ref: 'Space', default: [] }
}, {
  timestamps: { createdAt: false, updatedAt: 'updated_at' }
});

export const UserCommunityStats = model<IUserCommunityStats>('UserCommunityStats', UserCommunityStatsSchema);
export default UserCommunityStats;
