import { Router } from 'express';
import {
  postMessage,
  getSessions,
  getSessionMessages,
  postMessageFeedback,
  flagMessage,
  getTodayUsage,
} from '../controllers/gigiController';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  postGigiMessageSchema,
  postGigiFeedbackSchema,
  flagGigiMessageSchema,
} from '../validators/gigiValidator';

const router = Router();

// Apply auth protection globally to all Gigi chatbot routes
router.use(protect);

router.post('/message', validate(postGigiMessageSchema), postMessage);
router.get('/sessions', getSessions);
router.get('/sessions/:sessionId/messages', getSessionMessages);
router.post('/messages/:messageId/feedback', validate(postGigiFeedbackSchema), postMessageFeedback);
router.post('/messages/:messageId/flag', validate(flagGigiMessageSchema), flagMessage);
router.get('/usage/today', getTodayUsage);

export default router;
