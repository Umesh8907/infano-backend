import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/index';
import Space from '../src/models/Space';
import Post from '../src/models/Post';
import Comment from '../src/models/Comment';
import UserCommunityStats from '../src/models/UserCommunityStats';
import User from '../src/models/User';

// Helper to create chainable mongoose queries in test blocks
const mockQuery = (result: any) => {
  const query: any = {
    sort: jest.fn().mockImplementation(() => query),
    skip: jest.fn().mockImplementation(() => query),
    limit: jest.fn().mockImplementation(() => query),
    populate: jest.fn().mockImplementation(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };
  query.then = (onfulfilled: any) => Promise.resolve(result).then(onfulfilled);
  return query;
};

// Mock db connection
jest.mock('../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock User Model
jest.mock('../src/models/User', () => {
  const mockModel = {
    findById: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    User: mockModel,
  };
});

// Mock Space Model
jest.mock('../src/models/Space', () => {
  const localQuery = (res: any) => ({
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(res),
  });

  const mockModel = {
    find: jest.fn().mockImplementation(() => localQuery([])),
    findById: jest.fn(),
    findOne: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    Space: mockModel,
  };
});

// Mock Post Model
jest.mock('../src/models/Post', () => {
  const localQuery = (res: any) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(res),
  });

  const mockModel = {
    find: jest.fn().mockImplementation(() => localQuery([])),
    findById: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
  };
  return {
    __esModule: true,
    default: mockModel,
    Post: mockModel,
  };
});

// Mock Comment Model
jest.mock('../src/models/Comment', () => {
  const localQuery = (res: any) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(res),
  });

  const mockModel = {
    find: jest.fn().mockImplementation(() => localQuery([])),
    create: jest.fn(),
    findById: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    Comment: mockModel,
  };
});

// Mock UserCommunityStats Model
jest.mock('../src/models/UserCommunityStats', () => {
  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
  };
  return {
    __esModule: true,
    default: mockModel,
    UserCommunityStats: mockModel,
  };
});

describe('Community Module API Integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockSpaceId = '507f1f77bcf86cd799439022';
  let freeAccessToken: string;
  let plusAccessToken: string;

  beforeAll(() => {
    const jwt = require('../src/utils/jwt');
    freeAccessToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'free',
    });
    plusAccessToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'plus',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/community/spaces', () => {
    it('should successfully return list of active spaces', async () => {
      const mockSpaces = [
        { _id: mockSpaceId, name: 'Cycle Talk', slug: 'cycle-talk', is_active: true },
      ];
      (Space.find as jest.Mock).mockReturnValue(mockQuery(mockSpaces));
      (UserCommunityStats.findOne as jest.Mock).mockResolvedValue({
        followed_spaces: [mockSpaceId],
      });

      const res = await request(app)
        .get('/api/v1/community/spaces')
        .set('Authorization', `Bearer ${freeAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.spaces).toHaveLength(1);
      expect(res.body.data.spaces[0].is_following).toBe(true);
    });
  });

  describe('POST /api/v1/community/posts', () => {
    const validPostPayload = {
      space_id: mockSpaceId,
      type: 'text_post',
      title: 'Hello Infano',
      body: 'This is my first community post on Infano!',
    };

    it('should prevent free tier users from posting', async () => {
      const res = await request(app)
        .post('/api/v1/community/posts')
        .set('Authorization', `Bearer ${freeAccessToken}`)
        .send(validPostPayload);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('FORBIDDEN_ERROR');
    });

    it('should successfully allow plus/pro tier users to post', async () => {
      const mockSpace = { _id: mockSpaceId, name: 'Cycle Talk', post_count: 5, save: jest.fn() };
      (Space.findById as jest.Mock).mockResolvedValue(mockSpace);

      const mockCreatedPost = {
        _id: '507f1f77bcf86cd799439033',
        author_id: mockUserId,
        status: 'published',
        ...validPostPayload,
      };
      (Post.create as jest.Mock).mockResolvedValue(mockCreatedPost);
      (UserCommunityStats.findOne as jest.Mock).mockResolvedValue({
        post_count: 0,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/community/posts')
        .set('Authorization', `Bearer ${plusAccessToken}`)
        .send(validPostPayload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('published');
      expect(res.body.data.post).toBeDefined();
    });

    it('should hold post for review if content is flagged by moderation', async () => {
      const mockSpace = { _id: mockSpaceId, name: 'Cycle Talk', post_count: 5, save: jest.fn() };
      (Space.findById as jest.Mock).mockResolvedValue(mockSpace);

      // Trigger local mock blocklist violation
      const flaggedPayload = {
        ...validPostPayload,
        body: 'I want to harass someone.',
      };

      const mockFlaggedPost = {
        _id: '507f1f77bcf86cd799439033',
        author_id: mockUserId,
        status: 'pending_review',
        ...flaggedPayload,
      };
      (Post.create as jest.Mock).mockResolvedValue(mockFlaggedPost);
      (UserCommunityStats.findOne as jest.Mock).mockResolvedValue({
        violation_count: 0,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/community/posts')
        .set('Authorization', `Bearer ${plusAccessToken}`)
        .send(flaggedPayload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('pending_review');
      expect(res.body.message).toContain('review');
    });
  });

  describe('POST /api/v1/community/posts/:postId/react', () => {
    it('should successfully toggle post reaction', async () => {
      const mockPost = {
        _id: '507f1f77bcf86cd799439033',
        status: 'published',
        reactions: { heart: 0, support: 0, relate: 0, informative: 0 },
        reaction_by_user: new Map(),
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        author_id: 'anotherUserId',
      };
      (Post.findById as jest.Mock).mockResolvedValue(mockPost);
      (UserCommunityStats.findOne as jest.Mock).mockResolvedValue({
        reactions_received: 0,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/community/posts/507f1f77bcf86cd799439033/react')
        .set('Authorization', `Bearer ${freeAccessToken}`)
        .send({ reaction_type: 'heart' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reactions.heart).toBe(1);
      expect(res.body.data.user_reaction).toBe('heart');
    });
  });

  describe('POST /api/v1/community/posts/:postId/comments', () => {
    it('should prevent free tier users from commenting', async () => {
      const res = await request(app)
        .post('/api/v1/community/posts/507f1f77bcf86cd799439033/comments')
        .set('Authorization', `Bearer ${freeAccessToken}`)
        .send({ body: 'A comment.' });

      expect(res.status).toBe(403);
    });

    it('should allow plus/pro tier users to comment', async () => {
      const mockPost = { _id: '507f1f77bcf86cd799439033', status: 'published', comment_count: 0, save: jest.fn() };
      (Post.findById as jest.Mock).mockResolvedValue(mockPost);

      const mockComment = {
        _id: '507f1f77bcf86cd799439044',
        post_id: '507f1f77bcf86cd799439033',
        author_id: mockUserId,
        body: 'Great post!',
        status: 'published',
      };
      (Comment.create as jest.Mock).mockResolvedValue(mockComment);
      (UserCommunityStats.findOne as jest.Mock).mockResolvedValue({
        comment_count: 0,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/community/posts/507f1f77bcf86cd799439033/comments')
        .set('Authorization', `Bearer ${plusAccessToken}`)
        .send({ body: 'Great post!' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.comment.body).toBe('Great post!');
    });
  });
});
