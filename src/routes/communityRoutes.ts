import { Router } from 'express';
import {
  getSpaces,
  toggleSpaceFollow,
  getPosts,
  getPostDetail,
  createPost,
  editPost,
  deletePost,
  toggleReaction,
  flagPost,
  votePoll,
  getComments,
  createComment,
} from '../controllers/communityController';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  reactSchema,
  flagSchema,
  pollVoteSchema,
} from '../validators/communityValidator';

const router = Router();

// Apply authentication globally to all community endpoints
router.use(protect);

router.get('/spaces', getSpaces);
router.post('/spaces/:spaceId/follow', toggleSpaceFollow);
router.delete('/spaces/:spaceId/follow', toggleSpaceFollow);

router.get('/posts', getPosts);
router.get('/posts/:postId', getPostDetail);
router.post('/posts', validate(createPostSchema), createPost);
router.put('/posts/:postId', validate(updatePostSchema), editPost);
router.delete('/posts/:postId', deletePost);

router.post('/posts/:postId/react', validate(reactSchema), toggleReaction);
router.post('/posts/:postId/flag', validate(flagSchema), flagPost);
router.post('/posts/:postId/poll-vote', validate(pollVoteSchema), votePoll);

router.get('/posts/:postId/comments', getComments);
router.post('/posts/:postId/comments', validate(createCommentSchema), createComment);

export default router;
