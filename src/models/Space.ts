import { Schema, model, Document } from 'mongoose';

export interface ISpace extends Document {
  name: string;
  slug: string; // URL-friendly unique identifier
  description: string;
  tagline: string;
  icon_url: string;
  color: string; // hex color code for UI layout
  age_restricted: boolean;
  min_age?: number;
  max_age?: number;
  follower_count: number;
  post_count: number;
  is_active: boolean;
  created_at: Date;
}

const SpaceSchema = new Schema<ISpace>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  description: { type: String, required: true },
  tagline: { type: String, required: true },
  icon_url: { type: String, required: true },
  color: { type: String, default: '#7C3AED' }, // default purple
  age_restricted: { type: Boolean, default: false },
  min_age: { type: Number },
  max_age: { type: Number },
  follower_count: { type: Number, default: 0 },
  post_count: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

export const Space = model<ISpace>('Space', SpaceSchema);
export default Space;
