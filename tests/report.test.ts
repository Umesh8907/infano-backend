// Mock Puppeteer globally in this test file
jest.mock('puppeteer', () => {
  const mockPage = {
    setContent: jest.fn().mockResolvedValue(true),
    pdf: jest.fn().mockResolvedValue(Buffer.from('MOCK_PDF_CONTENT')),
  };
  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(true),
  };
  return {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  };
});

import request from 'supertest';
import { app } from '../src/index';
import User from '../src/models/User';
import DailyLog from '../src/models/DailyLog';
import CyclePrediction from '../src/models/CyclePrediction';

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

// Mock DailyLog Model
jest.mock('../src/models/DailyLog', () => {
  const mockQuery = (res: any) => ({
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(res),
  });
  
  const mockModel = {
    find: jest.fn().mockImplementation(() => mockQuery([])),
  };
  return {
    __esModule: true,
    default: mockModel,
    DailyLog: mockModel,
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

describe('Doctor Share Report API Integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  let accessToken: string;

  beforeAll(() => {
    const jwt = require('../src/utils/jwt');
    accessToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'free',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const mockQuery = (res: any) => ({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(res),
    });
    (DailyLog.find as jest.Mock).mockImplementation(() => mockQuery([]));
  });

  describe('GET /api/v1/health/report/download', () => {
    it('should return 400 validation error if range parameters are missing', async () => {
      const res = await request(app)
        .get('/api/v1/health/report/download')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should return 400 if from date is after to date', async () => {
      const res = await request(app)
        .get('/api/v1/health/report/download')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ from: '2026-06-07', to: '2026-06-01' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should successfully generate and stream PDF health report', async () => {
      const mockUser = {
        _id: mockUserId,
        name: 'Rhea Sen',
        phone: '+919876543210',
        onboarding_profile: { avg_cycle_length: 28, avg_period_duration: 5 },
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (CyclePrediction.findOne as jest.Mock).mockResolvedValue({
        cycle_phase_today: 'luteal',
      });

      const res = await request(app)
        .get('/api/v1/health/report/download')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ from: '2026-06-01', to: '2026-06-07' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('infano_health_report');
      expect(res.body.toString()).toBe('MOCK_PDF_CONTENT');
    });
  });
});
