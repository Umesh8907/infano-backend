import { Schema, model, Document, Types } from 'mongoose';

export interface ICycleRecord extends Document {
  user_id: Types.ObjectId;
  period_start_date: Date;
  period_end_date?: Date;
  cycle_length?: number; // Days until next period starts. Filled retroactively.
  period_duration?: number; // Days from start to end of period
  symptoms_during_period: string[];
  avg_mood_score?: number;
  avg_energy_score?: number;
  notes?: string;
  created_at: Date;
}

const CycleRecordSchema = new Schema<ICycleRecord>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  period_start_date: { type: Date, required: true, index: true },
  period_end_date: { type: Date },
  cycle_length: { type: Number },
  period_duration: { type: Number },
  symptoms_during_period: { type: [String], default: [] },
  avg_mood_score: { type: Number },
  avg_energy_score: { type: Number },
  notes: { type: String, trim: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Ensure sorting cycles chronological is highly indexed
CycleRecordSchema.index({ user_id: 1, period_start_date: -1 });

export const CycleRecord = model<ICycleRecord>('CycleRecord', CycleRecordSchema);
export default CycleRecord;
