import { Request, Response, NextFunction } from 'express';
import Space from '../models/Space';
import Post, { PostStatus } from '../models/Post';
import Comment from '../models/Comment';
import UserCommunityStats from '../models/UserCommunityStats';
import User from '../models/User';
import { checkContentModeration } from '../services/moderationService';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/appError';
import { logger } from '../utils/logger';

/**
 * Ensures user has a community stats document created
 */
const getOrCreateCommunityStats = async (userId: string) => {
  let stats = await UserCommunityStats.findOne({ user_id: userId });
  if (!stats) {
    stats = await UserCommunityStats.create({
      user_id: userId,
      followed_spaces: [],
    });
  }
  return stats;
};

/**
 * @desc    Get all community spaces with follow status
 * @route   GET /api/v1/community/spaces
 * @access  Private
 */
export const getSpaces = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new ValidationError('Auth required'));

    const spaces = await Space.find({ is_active: true }).exec();
    const stats = await getOrCreateCommunityStats(userId);

    const data = spaces.map(space => {
      const isFollowing = stats.followed_spaces.includes(space._id);
      return {
        ...(typeof space.toObject === 'function' ? space.toObject() : space),
        is_following: isFollowing,
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        spaces: data,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Follow or unfollow a space
 * @route   POST /api/v1/community/spaces/:spaceId/follow
 * @access  Private
 */
export const toggleSpaceFollow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { spaceId } = req.params;
    const isDelete = req.method === 'DELETE';

    if (!userId) return next(new ValidationError('Auth required'));

    const space = await Space.findById(spaceId);
    if (!space) return next(new NotFoundError('Space not found'));

    const stats = await getOrCreateCommunityStats(userId);
    const followingIdx = stats.followed_spaces.indexOf(space._id as any);

    if (isDelete) {
      if (followingIdx !== -1) {
        stats.followed_spaces.splice(followingIdx, 1);
        space.follower_count = Math.max(0, space.follower_count - 1);
      }
    } else {
      if (followingIdx === -1) {
        stats.followed_spaces.push(space._id as any);
        space.follower_count += 1;
      }
    }

    await stats.save();
    await space.save();

    res.status(200).json({
      status: 'success',
      message: isDelete ? 'Unfollowed space successfully' : 'Followed space successfully',
      data: {
        follower_count: space.follower_count,
        is_following: !isDelete,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get paginated community posts feed
 * @route   GET /api/v1/community/posts
 * @access  Private
 */
export const getPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { space, sort = 'recent', tag, page = '1', limit = '10' } = req.query as any;

    if (!userId) return next(new ValidationError('Auth required'));

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Filter queries
    const queryFilter: any = { status: 'published' };

    if (space) {
      const spaceObj = await Space.findOne({ slug: space });
      if (!spaceObj) return next(new NotFoundError('Space not found'));

      // Age restriction gating
      if (spaceObj.age_restricted) {
        const user = await User.findById(userId);
        if (!user || !user.age) {
          return next(new ForbiddenError('Age validation required to access this space'));
        }
        if (spaceObj.min_age && user.age < spaceObj.min_age) {
          return next(new ForbiddenError(`Access restricted: requires minimum age of ${spaceObj.min_age}`));
        }
        if (spaceObj.max_age && user.age > spaceObj.max_age) {
          return next(new ForbiddenError(`Access restricted: restricted for ages above ${spaceObj.max_age}`));
        }
      }

      queryFilter.space_id = spaceObj._id;
    }

    if (tag) {
      queryFilter.tags = tag;
    }

    // Sorting parameters
    let sortOption: any = { created_at: -1 };
    if (sort === 'top') {
      // Mock simple sorting metric based on reaction counts sum in memory or database aggregate
      // We will sort chronologically as fallback or standard sort in basic find
      sortOption = { 'reactions.heart': -1, 'reactions.support': -1, created_at: -1 };
    }

    const posts = await Post.find(queryFilter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('author_id', 'name avatar_url tier')
      .exec();

    const total = await Post.countDocuments(queryFilter);

    // Map anonymity details
    const mappedPosts = posts.map(post => {
      const obj = post.toObject() as any;
      if (post.is_anonymous) {
        obj.author_id = { name: 'Anonymous', avatar_url: '' };
      }
      obj.user_reaction = post.reaction_by_user.get(userId) || null;
      return obj;
    });

    res.status(200).json({
      status: 'success',
      data: {
        posts: mappedPosts,
        total,
        page: pageNum,
        has_more: skip + posts.length < total,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get single post detail with view counter increment
 * @route   GET /api/v1/community/posts/:postId
 * @access  Private
 */
export const getPostDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { postId } = req.params;

    if (!userId) return next(new ValidationError('Auth required'));

    const post = await Post.findById(postId).populate('author_id', 'name avatar_url tier');
    if (!post || post.status === 'removed') {
      return next(new NotFoundError('Post not found'));
    }

    post.view_count += 1;
    await post.save();

    const obj = post.toObject() as any;
    if (post.is_anonymous) {
      obj.author_id = { name: 'Anonymous', avatar_url: '' };
    }
    obj.user_reaction = post.reaction_by_user.get(userId) || null;

    res.status(200).json({
      status: 'success',
      data: {
        post: obj,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Create a new community post (Plus/Pro tier only)
 * @route   POST /api/v1/community/posts
 * @access  Private
 */
export const createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier;

    if (!userId || !userTier) return next(new ValidationError('Auth required'));

    // Gated posting privilege: free tier can only read
    if (userTier === 'free') {
      return next(new ForbiddenError('Posting is limited to Plus and Pro members. Please upgrade.'));
    }

    const { space_id, type, title, body, is_anonymous, tags, poll_options, media_url } = req.body;

    const space = await Space.findById(space_id);
    if (!space) return next(new NotFoundError('Space not found'));

    // Moderation screen check
    const contentToScreen = `${title || ''} ${body} ${tags ? tags.join(' ') : ''}`;
    const moderationResult = await checkContentModeration(contentToScreen);

    const postStatus: PostStatus = moderationResult.flagged ? 'pending_review' : 'published';

    const formattedPollOptions = poll_options
      ? poll_options.map((opt: any) => ({
          option_text: opt.option_text,
          vote_count: 0,
          voter_ids: [],
        }))
      : [];

    const post = await Post.create({
      space_id,
      author_id: userId,
      is_anonymous: is_anonymous ?? false,
      type,
      title,
      body,
      media_url,
      tags: tags ?? [],
      poll_options: formattedPollOptions,
      status: postStatus,
      ai_moderation_score: moderationResult.score,
    });

    const stats = await getOrCreateCommunityStats(userId);

    if (postStatus === 'published') {
      space.post_count += 1;
      await space.save();

      stats.post_count += 1;
      await stats.save();
    } else {
      stats.violation_count += 1;
      await stats.save();
      logger.warn(`Post created by user ${userId} flagged by moderation: "${moderationResult.reason}"`);
    }

    res.status(201).json({
      status: 'success',
      message: postStatus === 'published' ? 'Post created successfully' : 'Post is under review for content moderation',
      data: {
        post,
        status: postStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Edit post body/title (author only, within 30 minutes of creation)
 * @route   PUT /api/v1/community/posts/:postId
 * @access  Private
 */
export const editPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { postId } = req.params;
    const { title, body } = req.body;

    if (!userId) return next(new ValidationError('Auth required'));

    const post = await Post.findById(postId);
    if (!post || post.status === 'removed') return next(new NotFoundError('Post not found'));

    // Authorization check
    if (post.author_id.toString() !== userId) {
      return next(new ForbiddenError('You can only edit your own posts'));
    }

    // Time window validation: strictly within 30 minutes
    const diffMs = new Date().getTime() - new Date(post.created_at).getTime();
    const diffMins = diffMs / (1000 * 60);
    if (diffMins > 30) {
      return next(new ValidationError('Posts cannot be edited after 30 minutes of posting'));
    }

    // Re-moderate edited contents
    const moderationResult = await checkContentModeration(`${title || ''} ${body}`);
    if (moderationResult.flagged) {
      post.status = 'pending_review';
      post.ai_moderation_score = moderationResult.score;
      logger.warn(`Edited post by user ${userId} flagged by moderation`);
    }

    post.title = title ?? post.title;
    post.body = body;
    await post.save();

    res.status(200).json({
      status: 'success',
      message: post.status === 'published' ? 'Post updated successfully' : 'Post updated and sent for moderation review',
      data: {
        post,
        status: post.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Soft delete community post
 * @route   DELETE /api/v1/community/posts/:postId
 * @access  Private
 */
export const deletePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { postId } = req.params;

    if (!userId) return next(new ValidationError('Auth required'));

    const post = await Post.findById(postId);
    if (!post || post.status === 'removed') return next(new NotFoundError('Post not found'));

    if (post.author_id.toString() !== userId) {
      return next(new ForbiddenError('You can only delete your own posts'));
    }

    post.status = 'removed';
    post.body = '[Post removed by author]';
    post.title = undefined;
    post.media_url = undefined;
    await post.save();

    // Decrement counts
    await Space.updateOne({ _id: post.space_id }, { $inc: { post_count: -1 } });
    await UserCommunityStats.updateOne({ user_id: userId }, { $inc: { post_count: -1 } });

    res.status(200).json({
      status: 'success',
      message: 'Post deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Toggle post reaction
 * @route   POST /api/v1/community/posts/:postId/react
 * @access  Private
 */
export const toggleReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { postId } = req.params;
    const { reaction_type } = req.body as { reaction_type: 'heart' | 'support' | 'relate' | 'informative' };

    if (!userId) return next(new ValidationError('Auth required'));

    const post = await Post.findById(postId);
    if (!post || post.status !== 'published') return next(new NotFoundError('Post not found'));

    const existingReaction = post.reaction_by_user.get(userId);

    // Initial setup if map is undefined
    if (!post.reaction_by_user) {
      post.reaction_by_user = new Map();
    }

    if (existingReaction) {
      // Decrement count of previous reaction
      (post.reactions as any)[existingReaction] = Math.max(0, (post.reactions as any)[existingReaction] - 1);

      if (existingReaction === reaction_type) {
        // Remove reaction
        post.reaction_by_user.delete(userId);
      } else {
        // Toggle to new type
        (post.reactions as any)[reaction_type] += 1;
        post.reaction_by_user.set(userId, reaction_type);
      }
    } else {
      // Add reaction
      (post.reactions as any)[reaction_type] += 1;
      post.reaction_by_user.set(userId, reaction_type);
    }

    // Tracing stats for posts author
    if (post.author_id.toString() !== userId) {
      const diff = existingReaction === reaction_type ? -1 : 1;
      await UserCommunityStats.updateOne(
        { user_id: post.author_id },
        { $inc: { reactions_received: diff } }
      );
    }

    // Force Mongoose to recognize changes in Map structure
    post.markModified('reaction_by_user');
    await post.save();

    res.status(200).json({
      status: 'success',
      data: {
        reactions: post.reactions,
        user_reaction: post.reaction_by_user.get(userId) || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Flag/Report inappropriate post
 * @route   POST /api/v1/community/posts/:postId/flag
 * @access  Private
 */
export const flagPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { postId } = req.params;
    const { reason } = req.body;

    if (!userId) return next(new ValidationError('Auth required'));

    const post = await Post.findById(postId);
    if (!post || post.status !== 'published') return next(new NotFoundError('Post not found'));

    // Check if user has already flagged this post
    const alreadyFlagged = post.flags.some(f => f.user_id.toString() === userId);
    if (alreadyFlagged) {
      return next(new ValidationError('You have already flagged this post'));
    }

    post.flags.push({
      user_id: userId as any,
      reason,
      flagged_at: new Date(),
    });
    post.flag_count += 1;

    // Trigger auto review hold if flagged 3+ times
    if (post.flag_count >= 3) {
      post.status = 'pending_review';
      logger.warn(`Post ${postId} moved to review queue after receiving ${post.flag_count} reports.`);
    }

    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Post reported successfully',
      data: {
        flag_count: post.flag_count,
        status: post.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Submit vote in a poll (Plus/Pro tier only)
 * @route   POST /api/v1/community/posts/:postId/poll-vote
 * @access  Private
 */
export const votePoll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier;
    const { postId } = req.params;
    const { option_index } = req.body;

    if (!userId || !userTier) return next(new ValidationError('Auth required'));
    
    if (userTier === 'free') {
      return next(new ForbiddenError('Poll voting requires a premium subscription'));
    }

    const post = await Post.findById(postId);
    if (!post || post.status !== 'published') return next(new NotFoundError('Post not found'));
    if (post.type !== 'poll') return next(new ValidationError('This post is not a poll'));

    if (option_index < 0 || option_index >= post.poll_options.length) {
      return next(new ValidationError('Invalid poll option selected'));
    }

    // Check if user has already voted on any option in the poll
    const hasVoted = post.poll_options.some(opt => opt.voter_ids.some(id => id.toString() === userId));
    if (hasVoted) {
      return next(new ValidationError('You have already voted in this poll'));
    }

    post.poll_options[option_index].voter_ids.push(userId as any);
    post.poll_options[option_index].vote_count += 1;

    await post.save();

    res.status(200).json({
      status: 'success',
      data: {
        poll_options: post.poll_options,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get comments for a specific post
 * @route   GET /api/v1/community/posts/:postId/comments
 * @access  Private
 */
export const getComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { postId } = req.params;
    const { page = '1', limit = '20' } = req.query as any;

    if (!userId) return next(new ValidationError('Auth required'));

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch top-level comments (parent_comment_id is null/undefined)
    const comments = await Comment.find({
      post_id: postId,
      parent_comment_id: null,
      status: 'published',
    })
      .sort({ created_at: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate('author_id', 'name avatar_url tier')
      .exec();

    // Map anonymity details & fetch nested replies (1 level max)
    const commentsWithReplies = await Promise.all(
      comments.map(async comment => {
        const commentObj = comment.toObject() as any;
        if (comment.is_anonymous) {
          commentObj.author_id = { name: 'Anonymous', avatar_url: '' };
        }
        commentObj.user_reaction = comment.reaction_by_user.get(userId) || null;

        // Fetch nested replies (parent_comment_id equals this comment's id)
        const replies = await Comment.find({
          post_id: postId,
          parent_comment_id: comment._id,
          status: 'published',
        })
          .sort({ created_at: 1 })
          .populate('author_id', 'name avatar_url tier')
          .exec();

        commentObj.replies = replies.map(reply => {
          const replyObj = reply.toObject() as any;
          if (reply.is_anonymous) {
            replyObj.author_id = { name: 'Anonymous', avatar_url: '' };
          }
          replyObj.user_reaction = reply.reaction_by_user.get(userId) || null;
          return replyObj;
        });

        return commentObj;
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        comments: commentsWithReplies,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Submit comment or reply under post (Plus/Pro tier only)
 * @route   POST /api/v1/community/posts/:postId/comments
 * @access  Private
 */
export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userTier = req.user?.tier;
    const { postId } = req.params;
    const { body, parent_comment_id, is_anonymous } = req.body;

    if (!userId || !userTier) return next(new ValidationError('Auth required'));

    if (userTier === 'free') {
      return next(new ForbiddenError('Commenting is limited to Plus and Pro subscription tiers'));
    }

    const post = await Post.findById(postId);
    if (!post || post.status !== 'published') return next(new NotFoundError('Post not found'));

    // Moderation screen check
    const moderationResult = await checkContentModeration(body);
    const commentStatus = moderationResult.flagged ? 'pending_review' : 'published';

    // Verify parent comment is valid (cannot nest past depth 1)
    if (parent_comment_id) {
      const parentComment = await Comment.findById(parent_comment_id);
      if (!parentComment) return next(new NotFoundError('Parent comment not found'));
      if (parentComment.parent_comment_id) {
        return next(new ValidationError('Replies are only supported up to one level deep'));
      }
    }

    const comment = await Comment.create({
      post_id: postId,
      parent_comment_id: parent_comment_id || null,
      author_id: userId,
      is_anonymous: is_anonymous ?? false,
      body,
      status: commentStatus,
    });

    const stats = await getOrCreateCommunityStats(userId);

    if (commentStatus === 'published') {
      post.comment_count += 1;
      await post.save();

      stats.comment_count += 1;
      await stats.save();
    } else {
      stats.violation_count += 1;
      await stats.save();
      logger.warn(`Comment created by user ${userId} held for content moderation review`);
    }

    res.status(201).json({
      status: 'success',
      message: commentStatus === 'published' ? 'Comment saved successfully' : 'Comment held for moderation review',
      data: {
        comment,
        status: commentStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
};
