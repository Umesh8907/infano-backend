import { Schema, model, Document, Types } from 'mongoose';

export type PostType = 'text_post' | 'question' | 'poll' | 'story';
export type PostStatus = 'pending_review' | 'published' | 'removed';

export interface IPollOption {
  option_text: string;
  vote_count: number;
  voter_ids: Types.ObjectId[];
}

export interface IReactions {
  heart: number;
  support: number;
  relate: number;
  informative: number;
}

export interface IFlag {
  user_id: Types.ObjectId;
  reason: string;
  flagged_at: Date;
}

export interface IPost extends Document {
  space_id: Types.ObjectId;
  author_id: Types.ObjectId;
  is_anonymous: boolean;
  type: PostType;
  title?: string;
  body: string;
  media_url?: string;
  tags: string[];
  poll_options: IPollOption[];
  reactions: IReactions;
  reaction_by_user: Map<string, string>; // Maps userId string -> reaction type string
  comment_count: number;
  view_count: number;
  is_pinned: boolean;
  status: PostStatus;
  removed_reason?: string;
  removed_by?: Types.ObjectId;
  flag_count: number;
  flags: IFlag[];
  ai_moderation_score?: any;
  created_at: Date;
  updated_at: Date;
}

const PollOptionSchema = new Schema<IPollOption>({
  option_text: { type: String, required: true, trim: true },
  vote_count: { type: Number, default: 0 },
  voter_ids: { type: [Schema.Types.ObjectId], ref: 'User', default: [] }
}, { _id: false });

const FlagSchema = new Schema<IFlag>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  flagged_at: { type: Date, default: Date.now }
}, { _id: false });

const PostSchema = new Schema<IPost>({
  space_id: { type: Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
  author_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  is_anonymous: { type: Boolean, default: false },
  type: { 
    type: String, 
    enum: ['text_post', 'question', 'poll', 'story'], 
    default: 'text_post' 
  },
  title: { type: String, trim: true },
  body: { type: String, required: true, maxlength: 1500 },
  media_url: { type: String },
  tags: { type: [String], default: [] },
  poll_options: { type: [PollOptionSchema], default: [] },
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
  comment_count: { type: Number, default: 0 },
  view_count: { type: Number, default: 0 },
  is_pinned: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['pending_review', 'published', 'removed'], 
    default: 'published', // default publish unless AI scores flag it
    index: true 
  },
  removed_reason: { type: String },
  removed_by: { type: Schema.Types.ObjectId, ref: 'User' },
  flag_count: { type: Number, default: 0 },
  flags: { type: [FlagSchema], default: [] },
  ai_moderation_score: { type: Schema.Types.Mixed }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexing for chronologically feeding posts per space
PostSchema.index({ space_id: 1, status: 1, created_at: -1 });
PostSchema.index({ tags: 1 });

export const Post = model<IPost>('Post', PostSchema);
export default Post;
