import { Schema, model, Document, Types } from 'mongoose';

export interface ICyclePrediction extends Document {
  user_id: Types.ObjectId;
  generated_at: Date;
  model_version: 'bayesian_v1' | 'lstm_v1' | 'blended_v1';
  cycles_logged: number;
  next_period_start: Date;
  next_period_start_confidence_days: number;
  next_period_end_estimate: Date;
  ovulation_estimate: Date;
  fertile_window_start: Date;
  fertile_window_end: Date;
  cycle_phase_today: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  cycle_day_today: number;
  predicted_cycle_length: number;
  cycle_health_score: number; // 0-100 scale
  expires_at: Date;
}

const CyclePredictionSchema = new Schema<ICyclePrediction>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  generated_at: { type: Date, default: Date.now },
  model_version: { 
    type: String, 
    enum: ['bayesian_v1', 'lstm_v1', 'blended_v1'], 
    default: 'bayesian_v1' 
  },
  cycles_logged: { type: Number, default: 0 },
  next_period_start: { type: Date, required: true },
  next_period_start_confidence_days: { type: Number, default: 4 },
  next_period_end_estimate: { type: Date, required: true },
  ovulation_estimate: { type: Date, required: true },
  fertile_window_start: { type: Date, required: true },
  fertile_window_end: { type: Date, required: true },
  cycle_phase_today: { 
    type: String, 
    enum: ['menstrual', 'follicular', 'ovulation', 'luteal'], 
    default: 'follicular' 
  },
  cycle_day_today: { type: Number, default: 1 },
  predicted_cycle_length: { type: Number, default: 28 },
  cycle_health_score: { type: Number, min: 0, max: 100, default: 75 },
  expires_at: { type: Date, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const CyclePrediction = model<ICyclePrediction>('CyclePrediction', CyclePredictionSchema);
export default CyclePrediction;
