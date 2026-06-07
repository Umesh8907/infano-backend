// Mock Gigi Service
jest.mock('../src/services/gigiService', () => {
  const mockSafetyResponses = {
    self_harm: `I'm really sorry you're feeling this way, but please know you don't have to carry this alone. Please reach out to someone who can support you right now. \nIn India, you can call the iCALL helpline at **9152987821** (available Monday to Saturday, 10 AM to 8 PM) or the Vandrevala Foundation at **9999666555** (available 24/7). Please connect with them—they are warm, trained, and here to help.`,
    medical_emergency: `This sounds like it may need immediate medical attention. Please do not wait. Contact a trusted adult, call emergency services, or go to the nearest hospital immediately. In India, you can dial **112** for emergency assistance.`,
    off_topic: `I'm here to talk about women's health, wellness, and self-care! Let's focus on those topics—ask me anything about your cycle, symptoms, sleep, or general wellness.`,
  };

  const mockClassifyQuerySafety = (query: string) => {
    const queryLower = query.toLowerCase();
    if (queryLower.includes('suicide') || queryLower.includes('end my life')) {
      return 'self_harm';
    }
    if (queryLower.includes('bleeding heavily')) {
      return 'medical_emergency';
    }
    return 'safe';
  };

  return {
    __esModule: true,
    SAFETY_RESPONSES: mockSafetyResponses,
    classifyQuerySafety: mockClassifyQuerySafety,
    streamGigiResponse: jest.fn().mockImplementation(async (session, content, history, onChunk) => {
      console.log('MOCK STREAM GIGI CALLED');
      onChunk('Mock response chunk');
      return {
        text: 'Mock response chunk',
        model: 'mock-model',
      };
    }),
  };
});

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/index';
import User from '../src/models/User';
import GigiSession from '../src/models/GigiSession';
import GigiMessage from '../src/models/GigiMessage';
import GigiDailyUsage from '../src/models/GigiDailyUsage';
import CyclePrediction from '../src/models/CyclePrediction';
import * as gigiService from '../src/services/gigiService';

// Helper to create chainable mongoose queries in test blocks
const mockQuery = (result: any) => {
  const query: any = {
    sort: jest.fn().mockImplementation(() => query),
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

// Mock GigiSession Model
jest.mock('../src/models/GigiSession', () => {
  const mockModel = {
    find: jest.fn().mockImplementation(() => mockQuery([])),
    findById: jest.fn(),
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    GigiSession: mockModel,
  };
});

// Mock GigiMessage Model
jest.mock('../src/models/GigiMessage', () => {
  const mockModel = {
    find: jest.fn().mockImplementation(() => mockQuery([])),
    create: jest.fn(),
    findById: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    GigiMessage: mockModel,
  };
});

// Mock GigiDailyUsage Model
jest.mock('../src/models/GigiDailyUsage', () => {
  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    GigiDailyUsage: mockModel,
  };
});

// Mock CyclePrediction Model
jest.mock('../src/models/CyclePrediction', () => {
  const mockModel = {
    findOne: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    CyclePrediction: mockModel,
  };
});



describe('Gigi Talk Chatbot API Integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
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
    (gigiService.streamGigiResponse as jest.Mock).mockImplementation(async (session, content, history, onChunk) => {
      onChunk('Mock response chunk');
      return {
        text: 'Mock response chunk',
        model: 'mock-model',
      };
    });
  });

  describe('POST /api/v1/gigi/message', () => {
    it('should block free tier users if they exceed the daily message limit (5 msgs)', async () => {
      // Mock usage showing 5 messages sent today
      (GigiDailyUsage.findOne as jest.Mock).mockResolvedValue({
        message_count: 5,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/gigi/message')
        .set('Authorization', `Bearer ${freeAccessToken}`)
        .send({ content: 'Help me manage cramps' });

      expect(res.status).toBe(429);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('DAILY_LIMIT_EXCEEDED');
    });

    it('should bypass daily message limit for plus/pro tier users', async () => {
      (GigiDailyUsage.findOne as jest.Mock).mockResolvedValue({
        message_count: 8,
        save: jest.fn(),
      });
      (User.findById as jest.Mock).mockResolvedValue({
        _id: mockUserId,
        onboarding_profile: { health_conditions: [] },
      });
      (CyclePrediction.findOne as jest.Mock).mockResolvedValue({
        cycle_day_today: 14,
        cycle_phase_today: 'ovulation',
      });
      (GigiSession.create as jest.Mock).mockResolvedValue({
        _id: 'sessionId123',
        message_count: 0,
        save: jest.fn(),
      });
      (GigiMessage.create as jest.Mock).mockResolvedValue({
        _id: 'messageId123',
      });
      (GigiMessage.find as jest.Mock).mockReturnValue(mockQuery([]));

      // Attempt sending message
      const res = await request(app)
        .post('/api/v1/gigi/message')
        .set('Authorization', `Bearer ${plusAccessToken}`)
        .send({ content: 'Tell me about ovulation' });

      // SSE streams are returned as 200 with text/event-stream content type
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('should immediately intercept medical emergency prompts with standard warnings', async () => {
      (GigiDailyUsage.findOne as jest.Mock).mockResolvedValue({
        message_count: 0,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/gigi/message')
        .set('Authorization', `Bearer ${freeAccessToken}`)
        .send({ content: 'I am bleeding heavily and cannot stop.' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.safety_flagged).toBe(true);
      expect(res.body.content).toContain('immediate medical attention');
    });

    it('should immediately intercept self-harm prompts with hotline contact numbers', async () => {
      (GigiDailyUsage.findOne as jest.Mock).mockResolvedValue({
        message_count: 0,
        save: jest.fn(),
      });

      const res = await request(app)
        .post('/api/v1/gigi/message')
        .set('Authorization', `Bearer ${freeAccessToken}`)
        .send({ content: 'I want to end my life.' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.safety_flagged).toBe(true);
      expect(res.body.content).toContain('Vandrevala Foundation');
    });
  });

  describe('GET /api/v1/gigi/usage/today', () => {
    it('should return current usage and quota boundaries', async () => {
      (GigiDailyUsage.findOne as jest.Mock).mockResolvedValue({
        message_count: 3,
      });

      const res = await request(app)
        .get('/api/v1/gigi/usage/today')
        .set('Authorization', `Bearer ${freeAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.used).toBe(3);
      expect(res.body.data.limit).toBe(5);
      expect(res.body.data.is_unlimited).toBe(false);
    });
  });
});
