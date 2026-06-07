import { Schema, model, Document, Types } from 'mongoose';

export interface IGigiMessage extends Document {
  session_id: Types.ObjectId;
  user_id: Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  retrieved_chunks: Types.ObjectId[]; // refs to knowledge base vector documents
  model_used?: string;
  tokens_used?: number;
  latency_ms?: number;
  feedback?: 'positive' | 'negative';
  flagged: boolean;
  flag_reason?: string;
  created_at: Date;
}

const GigiMessageSchema = new Schema<IGigiMessage>({
  session_id: { type: Schema.Types.ObjectId, ref: 'GigiSession', required: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  retrieved_chunks: { type: [Schema.Types.ObjectId], ref: 'GigiKnowledgeBase', default: [] },
  model_used: { type: String },
  tokens_used: { type: Number },
  latency_ms: { type: Number },
  feedback: { type: String, enum: ['positive', 'negative', null], default: null },
  flagged: { type: Boolean, default: false },
  flag_reason: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Compound indexing for sorting session chat histories chronologically
GigiMessageSchema.index({ session_id: 1, created_at: 1 });

export const GigiMessage = model<IGigiMessage>('GigiMessage', GigiMessageSchema);
export default GigiMessage;
