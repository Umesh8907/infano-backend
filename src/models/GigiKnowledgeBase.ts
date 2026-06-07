import { Schema, model, Document } from 'mongoose';

export interface IGigiKnowledgeBase extends Document {
  title: string;
  content: string; // 2-4 paragraphs, ~300-500 words
  source?: string;
  source_url?: string;
  category: string;
  tags: string[];
  language: string;
  embedding?: number[]; // 1536 dimensions float array for OpenAI embeddings
  reviewed_by?: string;
  reviewed_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const GigiKnowledgeBaseSchema = new Schema<IGigiKnowledgeBase>({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  source: { type: String },
  source_url: { type: String },
  category: { type: String, required: true, index: true },
  tags: { type: [String], default: [] },
  language: { type: String, default: 'en' },
  embedding: { type: [Number] }, // Stored as array of floats
  reviewed_by: { type: String },
  reviewed_at: { type: Date },
  is_active: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const GigiKnowledgeBase = model<IGigiKnowledgeBase>('GigiKnowledgeBase', GigiKnowledgeBaseSchema);
export default GigiKnowledgeBase;
