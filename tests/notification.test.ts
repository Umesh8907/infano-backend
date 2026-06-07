import request from 'supertest';
import { app } from '../src/index';
import UserDevice from '../src/models/UserDevice';
import User from '../src/models/User';
import DailyLog from '../src/models/DailyLog';
import { sendDailyLogReminders } from '../src/services/notificationService';

// Mock db connection
jest.mock('../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock User Model
jest.mock('../src/models/User', () => {
  const mockModel = {
    find: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    User: mockModel,
  };
});

// Mock UserDevice Model
jest.mock('../src/models/UserDevice', () => {
  const mockModel = {
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    UserDevice: mockModel,
  };
});

// Mock DailyLog Model
jest.mock('../src/models/DailyLog', () => {
  const mockModel = {
    findOne: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    DailyLog: mockModel,
  };
});

// Helper to create chainable mongoose queries in test blocks
const mockQuery = (result: any) => {
  const query: any = {
    sort: jest.fn().mockImplementation(() => query),
    exec: jest.fn().mockResolvedValue(result),
  };
  query.then = (onfulfilled: any) => Promise.resolve(result).then(onfulfilled);
  return query;
};

describe('Notifications API Integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  let accessToken: string;

  beforeAll(() => {
    const jwt = require('../src/utils/jwt');
    accessToken = jwt.generateAccessToken({
      userId: mockUserId,
      phone: '+919876543210',
      tier: 'free',
    });

    if (!(User as any).find) (User as any).find = jest.fn();
    if (!(DailyLog as any).findOne) (DailyLog as any).findOne = jest.fn();
    if (!(UserDevice as any).find) (UserDevice as any).find = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/notifications/devices', () => {
    it('should successfully register a device token', async () => {
      (UserDevice.findOneAndUpdate as jest.Mock).mockResolvedValue({
        user_id: mockUserId,
        device_token: 'token123',
        platform: 'ios',
      });

      const res = await request(app)
        .post('/api/v1/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ device_token: 'token123', platform: 'ios' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(UserDevice.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should return 400 validation error for invalid platform enum', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ device_token: 'token123', platform: 'windows-phone' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/notifications/devices/:token', () => {
    it('should successfully deregister a device token', async () => {
      (UserDevice.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/v1/notifications/devices/token123')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('successfully');
    });
  });

  describe('Daily Log Reminders Service Logic', () => {
    it('should query active user preferences and send reminders to users who have not logged today', async () => {
      const mockUsers = [
        { _id: 'user1', name: 'Alisha', notification_preferences: { daily_log_reminder: true } },
        { _id: 'user2', name: 'Rhea', notification_preferences: { daily_log_reminder: true } },
      ];
      (User.find as jest.Mock).mockReturnValue(mockQuery(mockUsers));

      // User 1 has logged today, User 2 has not
      (DailyLog.findOne as jest.Mock)
        .mockReturnValueOnce(mockQuery({ _id: 'log1' })) // User 1
        .mockReturnValueOnce(mockQuery(null)); // User 2

      // User 2 has registered device token
      (UserDevice.find as jest.Mock).mockReturnValue(mockQuery([
        { device_token: 'token2_ios', platform: 'ios' },
      ]));

      const count = await sendDailyLogReminders();

      expect(count).toBe(1); // Only User 2 should get reminded
      expect(DailyLog.findOne).toHaveBeenCalledTimes(2);
      expect(UserDevice.find).toHaveBeenCalledWith({ user_id: 'user2' });
    });
  });
});
