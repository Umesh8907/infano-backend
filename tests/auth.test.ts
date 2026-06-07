import request from 'supertest';
import { app } from '../src/index';
import User from '../src/models/User';

// Mock db connection
jest.mock('../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock User mongoose model
jest.mock('../src/models/User', () => {
  const mockUserInstance = (data: any) => ({
    ...data,
    _id: '507f1f77bcf86cd799439011',
    tier: data.tier || 'free',
    onboarding_profile: data.onboarding_profile || { onboarding_completed: false },
    save: jest.fn().mockResolvedValue(true),
  });

  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((data) => Promise.resolve(mockUserInstance(data))),
    findById: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };

  return {
    __esModule: true,
    default: mockModel,
    User: mockModel,
  };
});

describe('Auth Endpoints Integration (Mocked DB)', () => {
  const testPhone = '+919876543210';
  let mockUserId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully request an OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ phone: testPhone });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toContain('OTP sent successfully');
  });

  it('should fail to request OTP with invalid phone number format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ phone: 'invalid-phone' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should verify OTP and register a new user if not exists', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    
    // Explicitly define return mock value for create in this test
    const mockCreatedUser = {
      _id: mockUserId,
      phone: testPhone,
      tier: 'free',
      onboarding_profile: { onboarding_completed: false },
      save: jest.fn().mockResolvedValue(true),
    };
    (User.create as jest.Mock).mockResolvedValue(mockCreatedUser);

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: testPhone, otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_new_user).toBe(true);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.user.phone).toBe(testPhone);
    expect(res.headers['set-cookie']).toBeDefined(); // HttpOnly refresh token cookie
  });

  it('should verify OTP and log in existing user', async () => {
    const existingUser = {
      _id: mockUserId,
      phone: testPhone,
      tier: 'free',
      onboarding_profile: { onboarding_completed: true },
      save: jest.fn().mockResolvedValue(true),
    };
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: testPhone, otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_new_user).toBe(false);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.user.id).toBe(mockUserId);
  });

  it('should restrict access to premium routes for free tier users', async () => {
    const freeUser = {
      _id: mockUserId,
      phone: testPhone,
      tier: 'free',
      onboarding_profile: { onboarding_completed: true },
      save: jest.fn().mockResolvedValue(true),
    };
    (User.findOne as jest.Mock).mockResolvedValue(freeUser);

    const resVerify = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: testPhone, otp: '123456' });
      
    const token = resVerify.body.data.access_token;
    
    const resPremium = await request(app)
      .get('/api/v1/test-premium')
      .set('Authorization', `Bearer ${token}`);
      
    expect(resPremium.status).toBe(403);
    expect(resPremium.body.status).toBe('error');
    expect(resPremium.body.code).toBe('FORBIDDEN_ERROR');
  });

  it('should permit access to premium routes for plus/pro tier users', async () => {
    const plusUser = {
      _id: mockUserId,
      phone: testPhone,
      tier: 'plus',
      onboarding_profile: { onboarding_completed: true },
      save: jest.fn().mockResolvedValue(true),
    };
    (User.findOne as jest.Mock).mockResolvedValue(plusUser);

    const resVerify = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: testPhone, otp: '123456' });
      
    const token = resVerify.body.data.access_token;
    
    const resPremium = await request(app)
      .get('/api/v1/test-premium')
      .set('Authorization', `Bearer ${token}`);
      
    expect(resPremium.status).toBe(200);
    expect(resPremium.body.status).toBe('success');
    expect(resPremium.body.message).toContain('premium resources');
  });
});
