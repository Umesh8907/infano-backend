import { Schema, model, Document, Types } from 'mongoose';

export type FlowType = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';

export interface IDailyLog extends Document {
  user_id: Types.ObjectId;
  date: Date; // Normalize to YYYY-MM-DD (midnight)
  period_started: boolean;
  period_ended: boolean;
  flow: FlowType;
  mood: string[];
  energy_level?: number; // 1-5 scale
  sleep_hours?: number; // 4-10 range
  symptoms: string[];
  water_intake_cups?: number;
  exercise_minutes?: number;
  weight_kg?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

const DailyLogSchema = new Schema<IDailyLog>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true },
  period_started: { type: Boolean, default: false },
  period_ended: { type: Boolean, default: false },
  flow: { 
    type: String, 
    enum: ['none', 'spotting', 'light', 'medium', 'heavy'], 
    default: 'none' 
  },
  mood: { type: [String], default: [] },
  energy_level: { type: Number, min: 1, max: 5 },
  sleep_hours: { type: Number, min: 0, max: 24 },
  symptoms: { type: [String], default: [] },
  water_intake_cups: { type: Number, min: 0 },
  exercise_minutes: { type: Number, min: 0 },
  weight_kg: { type: Number, min: 0 },
  notes: { type: String, trim: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Ensure a user can only have ONE log entry per calendar day
DailyLogSchema.index({ user_id: 1, date: 1 }, { unique: true });

export const DailyLog = model<IDailyLog>('DailyLog', DailyLogSchema);
export default DailyLog;
