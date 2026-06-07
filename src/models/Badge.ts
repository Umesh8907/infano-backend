import { Schema, model, Document } from 'mongoose';

export interface IBadge extends Document {
  name: string;
  description: string;
  image_url: string;
  type: 'episode_completion' | 'journey_completion' | 'streak' | 'special';
  criteria: Record<string, any>;
}

const BadgeSchema = new Schema<IBadge>({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  image_url: { type: String, required: true },
  type: {
    type: String,
    enum: ['episode_completion', 'journey_completion', 'streak', 'special'],
    required: true
  },
  criteria: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const Badge = model<IBadge>('Badge', BadgeSchema);
export default Badge;
