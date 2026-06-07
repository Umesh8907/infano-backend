import { Router } from 'express';
import { registerDevice, deregisterDevice } from '../controllers/notificationController';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { registerDeviceSchema, deregisterDeviceSchema } from '../validators/notificationValidator';

const router = Router();

// Apply authentication globally to all notifications routes
router.use(protect);

router.post('/devices', validate(registerDeviceSchema), registerDevice);
router.delete('/devices/:token', validate(deregisterDeviceSchema), deregisterDevice);

export default router;
