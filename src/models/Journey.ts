import { Schema, model, Document, Types } from 'mongoose';

export interface IJourney extends Document {
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  category: 'menstrual_health' | 'empowerment' | 'adolescent' | 'nutrition' | 'mental_health' | 'reproductive';
  target_audience: string[];
  tier_required: 'free' | 'plus' | 'pro';
  episode_ids: Types.ObjectId[];
  total_xp: number;
  completion_badge_id?: Types.ObjectId;
  estimated_hours: number;
  is_featured: boolean;
  language: string;
  status: 'draft' | 'published' | 'archived';
  created_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
}

const JourneySchema = new Schema<IJourney>({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  description: { type: String },
  cover_image_url: { type: String },
  category: {
    type: String,
    enum: ['menstrual_health', 'empowerment', 'adolescent', 'nutrition', 'mental_health', 'reproductive'],
    required: true
  },
  target_audience: { type: [String], default: [] },
  tier_required: { type: String, enum: ['free', 'plus', 'pro'], default: 'free' },
  episode_ids: [{ type: Schema.Types.ObjectId, ref: 'Episode' }],
  total_xp: { type: Number, default: 0 },
  completion_badge_id: { type: Schema.Types.ObjectId, ref: 'Badge' },
  estimated_hours: { type: Number, default: 0 },
  is_featured: { type: Boolean, default: false },
  language: { type: String, default: 'en' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  published_at: { type: Date }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const Journey = model<IJourney>('Journey', JourneySchema);
export default Journey;
