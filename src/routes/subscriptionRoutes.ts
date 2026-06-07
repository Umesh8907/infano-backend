import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/subscriptionController';

const router = Router();

// Public webhook route (Razorpay signatures will verify payload authenticity)
router.post('/razorpay/webhook', handleRazorpayWebhook);

export default router;
