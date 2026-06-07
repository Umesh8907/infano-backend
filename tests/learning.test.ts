import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/index';

// Helper for chainable mongoose queries in mock calls
const mockQuery = (result: any) => {
  const query: any = {
    sort: jest.fn().mockImplementation(() => query),
    populate: jest.fn().mockImplementation(() => query),
    limit: jest.fn().mockImplementation(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };
  query.then = (onfulfilled: any) => Promise.resolve(result).then(onfulfilled);
  return query;
};

// Mock db connection
jest.mock('../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock Journey model
jest.mock('../src/models/Journey', () => {
  const mockModel = {
    find: jest.fn().mockImplementation(() => mockQuery([])),
    findById: jest.fn().mockImplementation(() => mockQuery(null)),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    Journey: mockModel,
  };
});

// Mock Episode model
jest.mock('../src/models/Episode', () => {
  const mockModel = {
    find: jest.fn().mockImplementation(() => mockQuery([])),
    findById: jest.fn().mockImplementation(() => mockQuery(null)),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    Episode: mockModel,
  };
});

// Mock UserProgress model
jest.mock('../src/models/UserProgress', () => {
  const mockModel = {
    findOne: jest.fn().mockImplementation(() => mockQuery(null)),
    create: jest.fn(),
    find: jest.fn().mockImplementation(() => mockQuery([])),
    aggregate: jest.fn().mockImplementation(() => mockQuery([])),
  };
  return {
    __esModule: true,
    default: mockModel,
    UserProgress: mockModel,
  };
});

// Mock Badge model
jest.mock('../src/models/Badge', () => {
  const mockModel = {
    findById: jest.fn().mockImplementation(() => Promise.resolve(null)),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    Badge: mockModel,
  };
});

// Mock UserBadge model
jest.mock('../src/models/UserBadge', () => {
  const mockModel = {
    countDocuments: jest.fn().mockImplementation(() => mockQuery(0)),
    findOneAndUpdate: jest.fn().mockResolvedValue(true),
    find: jest.fn().mockImplementation(() => mockQuery([])),
  };
  return {
    __esModule: true,
    default: mockModel,
    UserBadge: mockModel,
  };
});

// Mock User Model
jest.mock('../src/models/User', () => {
  const mockModel = {
    findById: jest.fn().mockImplementation(() => Promise.resolve(null)),
    findOne: jest.fn().mockImplementation(() => Promise.resolve(null)),
    find: jest.fn().mockImplementation(() => mockQuery([])),
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    User: mockModel,
  };
});

// Mock DailyLog Model
jest.mock('../src/models/DailyLog', () => {
  const mockModel = {
    find: jest.fn().mockImplementation(() => mockQuery([])),
  };
  return {
    __esModule: true,
    default: mockModel,
    DailyLog: mockModel,
  };
});

import User from '../src/models/User';
import DailyLog from '../src/models/DailyLog';
import Journey from '../src/models/Journey';
import Episode from '../src/models/Episode';
import UserProgress from '../src/models/UserProgress';
import Badge from '../src/models/Badge';
import UserBadge from '../src/models/UserBadge';

describe('Learning Journey API Integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  let freeToken: string;
  let plusToken: string;

  const mockJourneyId = '507f1f77bcf86cd799439022';
  const mockEpisode1Id = '507f1f77bcf86cd799439033';
  const mockEpisode2Id = '507f1f77bcf86cd799439044';
  const mockActivityId = '507f1f77bcf86cd799439055';

  const mockJourneyData = {
    _id: mockJourneyId,
    title: 'Adolescent Menstrual Health',
    slug: 'my-body-my-story',
    description: 'Learn about menstruation',
    cover_image_url: 'https://img.com',
    category: 'adolescent',
    tier_required: 'free',
    episode_ids: [mockEpisode1Id, mockEpisode2Id],
    total_xp: 200,
    status: 'published',
  };

  const mockEpisode1Data = {
    _id: mockEpisode1Id,
    journey_id: mockJourneyId,
    order: 1,
    title: 'Episode 1',
    description: 'What is period?',
    is_free: true,
    total_xp: 100,
    status: 'published',
    activities: [
      {
        _id: mockActivityId,
        type: 'intro_video',
        order: 1,
        xp_value: 5,
        is_required: true,
        payload: { video_url: 'https://vid.com' },
      },
    ],
  };

  const mockEpisode2Data = {
    _id: mockEpisode2Id,
    journey_id: mockJourneyId,
    order: 2,
    title: 'Episode 2',
    description: 'Period Symptoms',
    is_free: false, // premium
    total_xp: 100,
    status: 'published',
    activities: [
      {
        _id: new Types.ObjectId().toString(),
        type: 'journal_entry',
        order: 1,
        xp_value: 15,
        is_required: true,
        payload: { prompt: 'Write reflection' },
      },
    ],
  };

  beforeAll(() => {
    // Dynamic mock checking/reassignment to prevent pollution in runInBand
    if (!User.findById) User.findById = jest.fn();
    if (!User.findOne) User.findOne = jest.fn();
    if (!User.find) User.find = jest.fn();
    if (!DailyLog.find) DailyLog.find = jest.fn();
    if (!Journey.find) Journey.find = jest.fn();
    if (!Journey.findById) Journey.findById = jest.fn();
    if (!Episode.find) Episode.find = jest.fn();
    if (!Episode.findById) Episode.findById = jest.fn();
    if (!UserProgress.findOne) UserProgress.findOne = jest.fn();
    if (!UserProgress.create) UserProgress.create = jest.fn();
    if (!UserProgress.find) UserProgress.find = jest.fn();
    if (!UserProgress.aggregate) UserProgress.aggregate = jest.fn();
    if (!Badge.findById) Badge.findById = jest.fn();
    if (!UserBadge.countDocuments) UserBadge.countDocuments = jest.fn();
    if (!UserBadge.find) UserBadge.find = jest.fn();

    const jwt = require('../src/utils/jwt');
    freeToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'free',
    });
    plusToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'plus',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default implementations returning empty chainable queries
    (Journey.find as jest.Mock).mockReturnValue(mockQuery([]));
    (Journey.findById as jest.Mock).mockReturnValue(mockQuery(null));
    (Episode.find as jest.Mock).mockReturnValue(mockQuery([]));
    (Episode.findById as jest.Mock).mockReturnValue(mockQuery(null));
    (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(null));
    (UserProgress.find as jest.Mock).mockReturnValue(mockQuery([]));
    (UserProgress.aggregate as jest.Mock).mockReturnValue(mockQuery([]));
    (Badge.findById as jest.Mock).mockReturnValue(mockQuery(null));
    (UserBadge.countDocuments as jest.Mock).mockReturnValue(mockQuery(0));
    (UserBadge.find as jest.Mock).mockReturnValue(mockQuery([]));
    (User.findById as jest.Mock).mockReturnValue(mockQuery(null));
    (User.findOne as jest.Mock).mockReturnValue(mockQuery(null));
    (User.find as jest.Mock).mockReturnValue(mockQuery([]));
    (DailyLog.find as jest.Mock).mockReturnValue(mockQuery([]));
  });

  describe('GET /api/v1/learning/journeys', () => {
    it('should successfully return list of published journeys', async () => {
      (Journey.find as jest.Mock).mockReturnValue(mockQuery([mockJourneyData]));
      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(null));

      const res = await request(app)
        .get('/api/v1/learning/journeys')
        .set('Authorization', `Bearer ${freeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].journey.title).toBe(mockJourneyData.title);
      expect(res.body.data[0].user_progress_summary.status).toBe('not_started');
    });
  });

  describe('GET /api/v1/learning/journeys/:journeyId', () => {
    it('should fetch journey details with locks applied correctly for free tier', async () => {
      (Journey.findById as jest.Mock).mockReturnValue(mockQuery(mockJourneyData));
      (Episode.find as jest.Mock).mockReturnValue(mockQuery([mockEpisode1Data, mockEpisode2Data]));
      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(null));

      const res = await request(app)
        .get(`/api/v1/learning/journeys/${mockJourneyId}`)
        .set('Authorization', `Bearer ${freeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.episodes.length).toBe(2);
      
      // Episode 1 should be available
      expect(res.body.data.episodes[0].status).toBe('available');
      
      // Episode 2 is premium-only, should be locked with requires_upgrade for free user
      expect(res.body.data.episodes[1].status).toBe('locked');
      expect(res.body.data.episodes[1].locked_reason).toBe('requires_upgrade');
    });

    it('should allow premium episodes to be available for plus tier users', async () => {
      (Journey.findById as jest.Mock).mockReturnValue(mockQuery(mockJourneyData));
      (Episode.find as jest.Mock).mockReturnValue(mockQuery([mockEpisode1Data, mockEpisode2Data]));
      
      // Mock progress showing episode 1 is completed
      const mockProgress = {
        user_id: mockUserId,
        journey_id: mockJourneyId,
        episode_progress: [
          { episode_id: mockEpisode1Id, status: 'completed', xp_earned: 100 },
        ],
      };
      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(mockProgress));

      const res = await request(app)
        .get(`/api/v1/learning/journeys/${mockJourneyId}`)
        .set('Authorization', `Bearer ${plusToken}`);

      expect(res.status).toBe(200);
      
      // Episode 2 should be available now because preceding episode 1 is completed and user is plus tier
      expect(res.body.data.episodes[1].status).toBe('available');
      expect(res.body.data.episodes[1].locked_reason).toBeNull();
    });
  });

  describe('GET /api/v1/learning/episodes/:episodeId', () => {
    it('should reject access to locked episodes (previous incomplete)', async () => {
      (Episode.findById as jest.Mock).mockReturnValue(mockQuery(mockEpisode2Data));
      (Episode.find as jest.Mock).mockReturnValue(mockQuery([mockEpisode1Data, mockEpisode2Data]));
      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(null));

      const res = await request(app)
        .get(`/api/v1/learning/episodes/${mockEpisode2Id}`)
        .set('Authorization', `Bearer ${plusToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ERROR');
    });
  });

  describe('POST /api/v1/learning/progress/start-journey', () => {
    it('should initialize progress document correctly', async () => {
      (Journey.findById as jest.Mock).mockReturnValue(mockQuery(mockJourneyData));
      (Episode.find as jest.Mock).mockReturnValue(mockQuery([mockEpisode1Data, mockEpisode2Data]));
      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(null));
      
      const mockCreatedProgress = {
        _id: '507f1f77bcf86cd799439066',
        user_id: mockUserId,
        journey_id: mockJourneyId,
        episode_progress: [],
      };
      (UserProgress.create as jest.Mock).mockResolvedValue(mockCreatedProgress);

      const res = await request(app)
        .post('/api/v1/learning/progress/start-journey')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({ journey_id: mockJourneyId });

      expect(res.status).toBe(200);
      expect(res.body.data.progress_id).toBe(mockCreatedProgress._id);
      expect(res.body.data.first_episode_id).toBe(mockEpisode1Id);
    });
  });

  describe('POST /api/v1/learning/progress/complete-activity', () => {
    it('should successfully complete a standard activity and award XP', async () => {
      (Episode.findById as jest.Mock).mockReturnValue(mockQuery(mockEpisode1Data));
      (Journey.findById as jest.Mock).mockReturnValue(mockQuery(mockJourneyData));
      (Episode.find as jest.Mock).mockReturnValue(mockQuery([mockEpisode1Data, mockEpisode2Data]));

      const mockSave = jest.fn().mockResolvedValue(true);
      const mockProgress = {
        _id: 'progressId123',
        user_id: mockUserId,
        journey_id: mockJourneyId,
        total_xp_earned: 0,
        episode_progress: [
          {
            episode_id: mockEpisode1Id,
            status: 'available',
            xp_earned: 0,
            activity_progress: [
              { activity_id: mockActivityId, status: 'not_started', xp_awarded: 0 },
            ],
            save: mockSave,
          },
        ],
        save: mockSave,
      };

      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(mockProgress));

      const res = await request(app)
        .post('/api/v1/learning/progress/complete-activity')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({
          episode_id: mockEpisode1Id,
          activity_id: mockActivityId,
          response: { watched_seconds: 90 },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.xp_awarded).toBe(5); // intro_video XP is 5
      expect(res.body.data.episode_completed).toBe(true); // only 1 activity in mockEpisode1Data
      expect(mockSave).toHaveBeenCalled();
    });

    it('should validate and fail assessment if score is below 70%', async () => {
      const assessmentActivityId = '507f1f77bcf86cd799439088';
      const mockEpisodeWithAssessment = {
        ...mockEpisode1Data,
        activities: [
          {
            _id: assessmentActivityId,
            type: 'assessment',
            order: 1,
            xp_value: 30,
            is_required: true,
            payload: {
              pass_threshold: 0.70,
              questions: [
                { question: 'Q1', correct_index: 1 },
                { question: 'Q2', correct_index: 2 },
              ],
            },
          },
        ],
      };

      (Episode.findById as jest.Mock).mockReturnValue(mockQuery(mockEpisodeWithAssessment));
      (Journey.findById as jest.Mock).mockReturnValue(mockQuery(mockJourneyData));
      (Episode.find as jest.Mock).mockReturnValue(mockQuery([mockEpisodeWithAssessment, mockEpisode2Data]));

      const mockSave = jest.fn().mockResolvedValue(true);
      const mockProgress = {
        _id: 'progressId123',
        user_id: mockUserId,
        journey_id: mockJourneyId,
        total_xp_earned: 0,
        episode_progress: [
          {
            episode_id: mockEpisode1Id,
            status: 'available',
            xp_earned: 0,
            activity_progress: [
              { activity_id: assessmentActivityId, status: 'not_started', xp_awarded: 0 },
            ],
            save: mockSave,
          },
        ],
        save: mockSave,
      };

      (UserProgress.findOne as jest.Mock).mockReturnValue(mockQuery(mockProgress));

      // Submit only 1 correct answer (50%, below 70% threshold)
      const res = await request(app)
        .post('/api/v1/learning/progress/complete-activity')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({
          episode_id: mockEpisode1Id,
          activity_id: assessmentActivityId,
          response: { answers: [1, 0] }, // Q1 correct (1), Q2 wrong (0 vs 2)
        });

      expect(res.status).toBe(200);
      expect(res.body.data.passed).toBe(false);
      expect(res.body.data.score).toBe(0.5);
      expect(res.body.data.xp_awarded).toBe(0);
    });
  });

  describe('GET /api/v1/learning/leaderboard', () => {
    it('should forbid access for free tier users', async () => {
      const res = await request(app)
        .get('/api/v1/learning/leaderboard')
        .set('Authorization', `Bearer ${freeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ERROR');
    });

    it('should successfully return leaderboard for plus tier users', async () => {
      (UserProgress.aggregate as jest.Mock).mockReturnValue(mockQuery([
        { _id: mockUserId, total_xp: 250 },
      ]));
      (User.find as jest.Mock).mockReturnValue(mockQuery([{
        _id: mockUserId,
        name: 'Priya',
        avatar_url: 'https://priya.com',
      }]));

      const res = await request(app)
        .get('/api/v1/learning/leaderboard')
        .set('Authorization', `Bearer ${plusToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.leaderboard.length).toBe(1);
      expect(res.body.data.leaderboard[0].display_name).toBe('Priya');
      expect(res.body.data.leaderboard[0].total_xp).toBe(250);
    });
  });
});
