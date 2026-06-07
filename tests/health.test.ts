import request from 'supertest';
import { app } from '../src/index';
import User from '../src/models/User';
import DailyLog from '../src/models/DailyLog';
import CycleRecord from '../src/models/CycleRecord';
import CyclePrediction from '../src/models/CyclePrediction';

// Helper to create chainable mongoose queries in test blocks
const mockQuery = (result: any) => {
  const query: any = {
    sort: jest.fn().mockImplementation(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };
  query.then = (onfulfilled: any) => Promise.resolve(result).then(onfulfilled);
  return query;
};

// Mock db connection
jest.mock('../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock LSTM Service
jest.mock('../src/services/lstmService', () => ({
  getLstmPrediction: jest.fn().mockResolvedValue(null),
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

// Mock DailyLog Model
jest.mock('../src/models/DailyLog', () => {
  const localQuery = (res: any) => {
    const q: any = {
      sort: jest.fn().mockImplementation(() => q),
      exec: jest.fn().mockResolvedValue(res),
    };
    q.then = (cb: any) => Promise.resolve(res).then(cb);
    return q;
  };

  const mockModel = {
    findOneAndUpdate: jest.fn().mockImplementation(() => localQuery({})),
    find: jest.fn().mockImplementation(() => localQuery([])),
    findOne: jest.fn().mockImplementation(() => localQuery(null)),
    deleteMany: jest.fn().mockImplementation(() => localQuery({ deletedCount: 0 })),
  };

  return {
    __esModule: true,
    default: mockModel,
    DailyLog: mockModel,
  };
});

// Mock CycleRecord Model
jest.mock('../src/models/CycleRecord', () => {
  const localQuery = (res: any) => {
    const q: any = {
      sort: jest.fn().mockImplementation(() => q),
      exec: jest.fn().mockResolvedValue(res),
    };
    q.then = (cb: any) => Promise.resolve(res).then(cb);
    return q;
  };

  const mockModel = {
    find: jest.fn().mockImplementation(() => localQuery([])),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, _id: 'cycleId123' })),
    deleteMany: jest.fn().mockImplementation(() => localQuery({ deletedCount: 0 })),
  };

  return {
    __esModule: true,
    default: mockModel,
    CycleRecord: mockModel,
  };
});

// Mock CyclePrediction Model
jest.mock('../src/models/CyclePrediction', () => {
  const localQuery = (res: any) => {
    const q: any = {
      sort: jest.fn().mockImplementation(() => q),
      exec: jest.fn().mockResolvedValue(res),
    };
    q.then = (cb: any) => Promise.resolve(res).then(cb);
    return q;
  };

  const mockModel = {
    findOneAndUpdate: jest.fn().mockImplementation(() => localQuery({})),
    findOne: jest.fn().mockImplementation(() => localQuery(null)),
  };

  return {
    __esModule: true,
    default: mockModel,
    CyclePrediction: mockModel,
  };
});

describe('Health Tracker API integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  let accessToken: string;

  beforeAll(() => {
    // Generate valid mock accessToken
    const jwt = require('../src/utils/jwt');
    accessToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'free',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default implementations returning chainable queries
    (User.findById as jest.Mock).mockResolvedValue(null);
    (DailyLog.findOneAndUpdate as jest.Mock).mockReturnValue(mockQuery({}));
    (DailyLog.find as jest.Mock).mockReturnValue(mockQuery([]));
    (DailyLog.findOne as jest.Mock).mockReturnValue(mockQuery(null));
    (DailyLog.deleteMany as jest.Mock).mockReturnValue(mockQuery({ deletedCount: 0 }));
    (CycleRecord.find as jest.Mock).mockReturnValue(mockQuery([]));
    (CycleRecord.create as jest.Mock).mockImplementation((data) => Promise.resolve({ ...data, _id: 'cycleId123' }));
    (CycleRecord.deleteMany as jest.Mock).mockReturnValue(mockQuery({ deletedCount: 0 }));
    (CyclePrediction.findOneAndUpdate as jest.Mock).mockImplementation((filter, update) => mockQuery(update));
    (CyclePrediction.findOne as jest.Mock).mockReturnValue(mockQuery(null));
  });

  describe('POST /api/v1/health/logs', () => {
    const validLogPayload = {
      date: '2026-06-01',
      flow: 'medium',
      mood: ['happy', 'energetic'],
      energy_level: 4,
      sleep_hours: 8,
      symptoms: ['bloating'],
      water_intake_cups: 6,
      exercise_minutes: 30,
      notes: 'Feeling great!',
    };

    it('should successfully save a daily log', async () => {
      const mockUser = {
        _id: mockUserId,
        onboarding_profile: {
          last_period_date: new Date('2026-05-15'),
          avg_cycle_length: 28,
          avg_period_duration: 5,
          health_conditions: [],
        },
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const mockSavedLog = {
        ...validLogPayload,
        _id: 'logId123',
        user_id: mockUserId,
        date: new Date('2026-06-01'),
      };
      (DailyLog.findOneAndUpdate as jest.Mock).mockReturnValue(mockQuery(mockSavedLog));

      // Mocks for cycleService and predictionService updates
      (DailyLog.find as jest.Mock).mockReturnValue(mockQuery([mockSavedLog]));
      (CycleRecord.deleteMany as jest.Mock).mockReturnValue(mockQuery({ deletedCount: 0 }));
      (CycleRecord.find as jest.Mock).mockReturnValue(mockQuery([]));
      (CyclePrediction.findOneAndUpdate as jest.Mock).mockReturnValue(mockQuery({
        next_period_start: new Date('2026-06-12'),
        cycle_phase_today: 'follicular',
      }));

      const res = await request(app)
        .post('/api/v1/health/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validLogPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.log).toBeDefined();
      expect(res.body.data.log.flow).toBe('medium');
      expect(res.body.data.prediction).toBeDefined();
    });

    it('should return 400 validation error for invalid date format', async () => {
      const res = await request(app)
        .post('/api/v1/health/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validLogPayload, date: '01-06-2026' }); // invalid format

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 validation error for out-of-range sleep hours', async () => {
      const res = await request(app)
        .post('/api/v1/health/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validLogPayload, sleep_hours: 30 }); // exceeds 24

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/health/logs', () => {
    it('should return logs in a specified date range', async () => {
      const mockLogs = [
        { date: new Date('2026-06-01'), flow: 'medium' },
        { date: new Date('2026-06-02'), flow: 'light' },
      ];
      (DailyLog.find as jest.Mock).mockReturnValue(mockQuery(mockLogs));

      const res = await request(app)
        .get('/api/v1/health/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ from: '2026-06-01', to: '2026-06-07' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.logs).toHaveLength(2);
    });

    it('should return 400 if date query params are missing', async () => {
      const res = await request(app)
        .get('/api/v1/health/logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/health/predictions/calendar', () => {
    it('should calculate and return calendar events for a month', async () => {
      const mockUser = {
        _id: mockUserId,
        onboarding_profile: {
          last_period_date: new Date('2026-05-15'),
          avg_cycle_length: 28,
          avg_period_duration: 5,
          health_conditions: [],
        },
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Empty logs for the month
      (DailyLog.find as jest.Mock).mockReturnValue(mockQuery([]));

      // Mock sorted cycle records search inside updatePredictionCache
      (CycleRecord.find as jest.Mock).mockReturnValue(mockQuery([]));

      // Mock returning a prediction object
      const mockPrediction = {
        next_period_start: new Date('2026-06-12T00:00:00.000Z'),
        next_period_end_estimate: new Date('2026-06-16T00:00:00.000Z'),
        ovulation_estimate: new Date('2026-05-29T00:00:00.000Z'),
        fertile_window_start: new Date('2026-05-27T00:00:00.000Z'),
        fertile_window_end: new Date('2026-05-31T00:00:00.000Z'),
      };
      (CyclePrediction.findOneAndUpdate as jest.Mock).mockReturnValue(mockQuery(mockPrediction));

      const res = await request(app)
        .get('/api/v1/health/predictions/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ month: '2026-06' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.events).toBeDefined();
      
      // Verify that predicted period days in June are marked
      const periodEvents = res.body.data.events.filter((e: any) => e.type === 'period' && e.source === 'predicted');
      expect(periodEvents.length).toBeGreaterThan(0);
    });
  });

  describe('LSTM Blending Predictions', () => {
    it('should blend Bayesian and LSTM predictions when user has 3+ logged cycles', async () => {
      const mockUser = {
        _id: mockUserId,
        onboarding_profile: {
          last_period_date: new Date('2026-05-15'),
          avg_cycle_length: 28,
          avg_period_duration: 5,
          health_conditions: [],
        },
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Return 3 cycle records
      const mockCycles = [
        { period_start_date: new Date('2026-05-15'), cycle_length: 29, period_duration: 5 },
        { period_start_date: new Date('2026-04-16'), cycle_length: 28, period_duration: 5 },
        { period_start_date: new Date('2026-03-19'), cycle_length: 30, period_duration: 5 },
      ];
      (CycleRecord.find as jest.Mock).mockReturnValue(mockQuery(mockCycles));

      // Mock LSTM to return 30 days
      const { getLstmPrediction } = require('../src/services/lstmService');
      (getLstmPrediction as jest.Mock).mockResolvedValue(30);

      // Mock update prediction cache database execution
      (CyclePrediction.findOneAndUpdate as jest.Mock).mockImplementation((filter: any, update: any) => {
        return mockQuery({ ...update, _id: 'prediction123' });
      });

      // Call the update prediction cache directly
      const { updatePredictionCache } = require('../src/services/predictionService');
      const prediction = await updatePredictionCache(mockUserId, mockUser as any, new Date('2026-06-01'));

      expect(getLstmPrediction).toHaveBeenCalledWith(mockUserId, expect.any(Array));
      expect(prediction.model_version).toBe('blended_v1');
      expect(prediction.predicted_cycle_length).toBe(30);
    });

    it('should fallback to Bayesian prediction if LSTM service returns null', async () => {
      const mockUser = {
        _id: mockUserId,
        onboarding_profile: {
          last_period_date: new Date('2026-05-15'),
          avg_cycle_length: 28,
          avg_period_duration: 5,
          health_conditions: [],
        },
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Return 3 cycle records
      const mockCycles = [
        { period_start_date: new Date('2026-05-15'), cycle_length: 29, period_duration: 5 },
        { period_start_date: new Date('2026-04-16'), cycle_length: 28, period_duration: 5 },
        { period_start_date: new Date('2026-03-19'), cycle_length: 30, period_duration: 5 },
      ];
      (CycleRecord.find as jest.Mock).mockReturnValue(mockQuery(mockCycles));

      // Mock LSTM to return null (down or error)
      const { getLstmPrediction } = require('../src/services/lstmService');
      (getLstmPrediction as jest.Mock).mockResolvedValue(null);

      const { updatePredictionCache } = require('../src/services/predictionService');
      const prediction = await updatePredictionCache(mockUserId, mockUser as any, new Date('2026-06-01'));

      expect(prediction.model_version).toBe('bayesian_v1');
    });
  });
});
