import { Schema, model, Document, Types } from 'mongoose';
import { IReactions } from './Post';

export interface IComment extends Document {
  post_id: Types.ObjectId;
  parent_comment_id?: Types.ObjectId; // self reference for nested comments (nesting depth limit = 1)
  author_id: Types.ObjectId;
  is_anonymous: boolean;
  body: string;
  reactions: IReactions;
  reaction_by_user: Map<string, string>;
  status: 'pending_review' | 'published' | 'removed';
  flag_count: number;
  created_at: Date;
  updated_at: Date;
}

const CommentSchema = new Schema<IComment>({
  post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  parent_comment_id: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  is_anonymous: { type: Boolean, default: false },
  body: { type: String, required: true, maxlength: 500 },
  reactions: {
    heart: { type: Number, default: 0 },
    support: { type: Number, default: 0 },
    relate: { type: Number, default: 0 },
    informative: { type: Number, default: 0 }
  },
  reaction_by_user: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  status: { 
    type: String, 
    enum: ['pending_review', 'published', 'removed'], 
    default: 'published',
    index: true 
  },
  flag_count: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexing for nested comment queries sorted chronologically
CommentSchema.index({ post_id: 1, parent_comment_id: 1, created_at: 1 });

export const Comment = model<IComment>('Comment', CommentSchema);
export default Comment;
