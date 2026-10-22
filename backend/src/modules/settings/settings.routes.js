import { Router } from 'express';
import settingsController from './settings.controller.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';

const router = Router();

router.use(auth);

// View current consideration timing window setting (all authenticated roles)
router.get('/consideration-window', settingsController.getConsiderationWindow);

// Toggle / update consideration timing window (ADMIN only)
router.patch(
  '/consideration-window',
  authorize('ADMIN'),
  settingsController.setConsiderationWindow
);

export default router;
