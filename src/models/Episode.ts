import { Schema, model, Document, Types } from 'mongoose';

export interface IActivity {
  _id: Types.ObjectId;
  type: 'intro_video' | 'story_card' | 'image_paragraph' | 'character_dialogue' | 'multiple_choice' | 'journal_entry' | 'assessment' | 'summary_card';
  order: number;
  xp_value: number;
  is_required: boolean;
  estimated_minutes?: number;
  payload: any;
}

export interface IEpisode extends Document {
  journey_id: Types.ObjectId;
  order: number;
  title: string;
  description: string;
  thumbnail_url: string;
  duration_minutes: number;
  total_xp: number;
  is_free: boolean;
  pass_threshold: number; // e.g. 0.70 for 70% pass score
  activities: IActivity[];
  status: 'draft' | 'published';
  created_at: Date;
  updated_at: Date;
}

const ActivitySchema = new Schema<IActivity>({
  _id: { type: Schema.Types.ObjectId, required: true, default: () => new Types.ObjectId() },
  type: {
    type: String,
    enum: ['intro_video', 'story_card', 'image_paragraph', 'character_dialogue', 'multiple_choice', 'journal_entry', 'assessment', 'summary_card'],
    required: true
  },
  order: { type: Number, required: true },
  xp_value: { type: Number, required: true },
  is_required: { type: Boolean, default: true },
  estimated_minutes: { type: Number },
  payload: { type: Schema.Types.Mixed, required: true }
}, { _id: false });

const EpisodeSchema = new Schema<IEpisode>({
  journey_id: { type: Schema.Types.ObjectId, ref: 'Journey', required: true, index: true },
  order: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  thumbnail_url: { type: String },
  duration_minutes: { type: Number, default: 0 },
  total_xp: { type: Number, default: 0 },
  is_free: { type: Boolean, default: false },
  pass_threshold: { type: Number, default: 0.70 },
  activities: { type: [ActivitySchema], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index to query by order inside a journey
EpisodeSchema.index({ journey_id: 1, order: 1 });

export const Episode = model<IEpisode>('Episode', EpisodeSchema);
export default Episode;
