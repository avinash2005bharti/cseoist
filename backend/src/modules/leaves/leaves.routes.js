import { Router } from 'express';
import leavesController from './leaves.controller.js';
import {
  createLeaveSchema,
  tgReviewLeaveSchema,
  finalReviewLeaveSchema,
} from './leaves.schema.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(auth);

// Apply for leave (Students, Teachers, HOD)
router.post(
  '/',
  authorize('STUDENT', 'TEACHER', 'HOD'),
  validateBody(createLeaveSchema),
  leavesController.createLeave
);

// My leaves
router.get(
  '/mine',
  leavesController.getMine
);

// TG review queue
router.get(
  '/tg-queue',
  authorize('TG'),
  leavesController.getTGQueue
);

// HOD review queue
router.get(
  '/hod-queue',
  authorize('HOD', 'ADMIN'),
  leavesController.getHODQueue
);

// HOD / Admin / TG recommendations history
router.get(
  '/tg-history',
  authorize('HOD', 'ADMIN', 'TG'),
  leavesController.getTGHistory
);

// Admin review queue (for HOD leaves)
router.get(
  '/admin-queue',
  authorize('ADMIN'),
  leavesController.getAdminQueue
);

// Get single leave application
router.get(
  '/:id',
  leavesController.getById
);

// Cancel own leave application
router.patch(
  '/:id/cancel',
  leavesController.cancel
);

// TG review
router.patch(
  '/:id/tg-review',
  authorize('TG'),
  validateBody(tgReviewLeaveSchema),
  leavesController.tgReview
);

// Final review (HOD or Admin)
router.patch(
  '/:id/final-review',
  authorize('HOD', 'ADMIN'),
  validateBody(finalReviewLeaveSchema),
  leavesController.finalReview
);

export default router;
