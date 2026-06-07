import { Router } from 'express';
import { sendOTP, verifyOTP, refreshToken, logout } from '../controllers/authController';
import { validate } from '../middlewares/validate';
import { sendOtpSchema, verifyOtpSchema } from '../validators/authValidator';

const router = Router();

router.post('/send-otp', validate(sendOtpSchema), sendOTP);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOTP);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
