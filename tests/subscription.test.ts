import request from 'supertest';
import { app } from '../src/index';
import User from '../src/models/User';
import crypto from 'crypto';

// Mock db connection
jest.mock('../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock User Model
jest.mock('../src/models/User', () => {
  const mockModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockModel,
    User: mockModel,
  };
});

describe('Subscription API Webhook Integration (Mocked DB)', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const webhookSecret = 'test-webhook-secret';

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const generateSignature = (payload: string): string => {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
  };

  describe('POST /api/v1/subscriptions/razorpay/webhook', () => {
    it('should fail if signature header is missing', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/razorpay/webhook')
        .send({ event: 'subscription.charged' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should fail if signature is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/razorpay/webhook')
        .set('x-razorpay-signature', 'invalid-signature')
        .send({ event: 'subscription.charged' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should successfully update user to plus tier on subscription.charged', async () => {
      const mockUser = {
        _id: mockUserId,
        tier: 'free',
        save: jest.fn().mockResolvedValue(true),
      };
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const payload = {
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: 'sub_active123',
              status: 'active',
              current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              notes: {
                user_id: mockUserId,
                tier: 'plus',
              },
            },
          },
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const res = await request(app)
        .post('/api/v1/subscriptions/razorpay/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payloadString);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(mockUser.tier).toBe('plus');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should successfully downgrade user to free tier on subscription.cancelled', async () => {
      const mockUser = {
        _id: mockUserId,
        tier: 'pro',
        save: jest.fn().mockResolvedValue(true),
      };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      const payload = {
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_active123',
              status: 'cancelled',
              notes: {},
            },
          },
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const res = await request(app)
        .post('/api/v1/subscriptions/razorpay/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payloadString);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(mockUser.tier).toBe('free');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
