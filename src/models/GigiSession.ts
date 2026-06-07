import { Schema, model, Document, Types } from 'mongoose';

export interface IGigiSession extends Document {
  user_id: Types.ObjectId;
  started_at: Date;
  last_message_at: Date;
  message_count: number;
  session_context: {
    cycle_day?: number;
    cycle_phase?: string;
    health_conditions: string[];
    age_group?: 'adolescent' | 'adult';
  };
}

const GigiSessionSchema = new Schema<IGigiSession>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  started_at: { type: Date, default: Date.now },
  last_message_at: { type: Date, default: Date.now },
  message_count: { type: Number, default: 0 },
  session_context: {
    cycle_day: { type: Number },
    cycle_phase: { type: String },
    health_conditions: { type: [String], default: [] },
    age_group: { type: String, enum: ['adolescent', 'adult'], default: 'adult' }
  }
}, {
  timestamps: { createdAt: 'started_at', updatedAt: 'last_message_at' }
});

export const GigiSession = model<IGigiSession>('GigiSession', GigiSessionSchema);
export default GigiSession;
