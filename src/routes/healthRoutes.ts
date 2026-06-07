import { Router } from 'express';
import {
  saveDailyLog,
  getLogsRange,
  getLogByDate,
  getCurrentPrediction,
  getCalendarEvents,
} from '../controllers/healthController';
import { downloadReport } from '../controllers/reportController';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createLogSchema,
  getLogsSchema,
  getLogByDateSchema,
} from '../validators/healthValidator';

const router = Router();

// Apply auth protection middleware globally to all health logs routes
router.use(protect);

router.post('/logs', validate(createLogSchema), saveDailyLog);
router.get('/logs', validate(getLogsSchema), getLogsRange);
router.get('/logs/:date', validate(getLogByDateSchema), getLogByDate);
router.get('/predictions/current', getCurrentPrediction);
router.get('/predictions/calendar', getCalendarEvents);
router.get('/report/download', validate(getLogsSchema), downloadReport);

export default router;
