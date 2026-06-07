import { Router } from 'express';
import { updateProfile } from '../controllers/userController';
import { protect } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { updateProfileSchema } from '../validators/userValidator';

const router = Router();

// Apply auth protection middleware globally to all user routes
router.use(protect);

router.put('/profile', validate(updateProfileSchema), updateProfile);

export default router;
