import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  getJourneys,
  getJourneyDetail,
  getEpisodeDetail,
  startJourney,
  completeActivity,
  getJourneyProgress,
  getLearningSummary,
  getUserBadges,
  getLeaderboard
} from '../controllers/learningController';
import {
  getJourneyDetailSchema,
  getEpisodeDetailSchema,
  startJourneySchema,
  completeActivitySchema,
  getJourneyProgressSchema
} from '../validators/learningValidator';

const router = Router();

// Secure all learning routes
router.use(protect);

router.get('/journeys', getJourneys);
router.get('/journeys/:journeyId', validate(getJourneyDetailSchema), getJourneyDetail);
router.get('/episodes/:episodeId', validate(getEpisodeDetailSchema), getEpisodeDetail);

router.post('/progress/start-journey', validate(startJourneySchema), startJourney);
router.post('/progress/complete-activity', validate(completeActivitySchema), completeActivity);
router.get('/progress/journey/:journeyId', validate(getJourneyProgressSchema), getJourneyProgress);
router.get('/progress/summary', getLearningSummary);

router.get('/badges/mine', getUserBadges);
router.get('/leaderboard', getLeaderboard);

export default router;
