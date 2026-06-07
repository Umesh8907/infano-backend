import { Schema, model, Document, Types } from 'mongoose';

export interface IGigiDailyUsage extends Document {
  user_id: Types.ObjectId;
  date: Date; // Normalize to YYYY-MM-DD
  message_count: number;
}

const GigiDailyUsageSchema = new Schema<IGigiDailyUsage>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  message_count: { type: Number, default: 0 }
}, {
  timestamps: false
});

// Compound unique indexing for tracking daily message limits
GigiDailyUsageSchema.index({ user_id: 1, date: 1 }, { unique: true });

export const GigiDailyUsage = model<IGigiDailyUsage>('GigiDailyUsage', GigiDailyUsageSchema);
export default GigiDailyUsage;
