import { Router } from 'express';
import considerationsController from './considerations.controller.js';
import {
  createConsiderationSchema,
  tgReviewSchema,
  hodReviewSchema,
  auditStudentSchema,
  auditAllStudentsSchema,
} from './considerations.schema.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import { validateBody } from '../../middleware/validate.js';

const router = Router();

router.use(auth);

// Student creates consideration
router.post(
  '/',
  authorize('STUDENT'),
  validateBody(createConsiderationSchema),
  considerationsController.createConsideration
);

// Student views own considerations
router.get(
  '/mine',
  authorize('STUDENT'),
  considerationsController.getMine
);

// TG review queue
router.get(
  '/tg-queue',
  authorize('TG'),
  considerationsController.getTGQueue
);

// HOD / Admin review queue
router.get(
  '/hod-queue',
  authorize('HOD', 'ADMIN'),
  considerationsController.getHODQueue
);

// View single request
router.get(
  '/:id',
  considerationsController.getById
);

// Student cancel request
router.patch(
  '/:id/cancel',
  authorize('STUDENT'),
  considerationsController.cancel
);

// TG review
router.patch(
  '/:id/tg-review',
  authorize('TG'),
  validateBody(tgReviewSchema),
  considerationsController.tgReview
);

// HOD final decision
router.patch(
  '/:id/final-review',
  authorize('HOD', 'ADMIN'),
  validateBody(hodReviewSchema),
  considerationsController.hodReview
);

// Audit individual student in group consideration (TG, HOD, Admin)
router.patch(
  '/:id/audit-student',
  authorize('TG', 'HOD', 'ADMIN'),
  validateBody(auditStudentSchema),
  considerationsController.auditGroupStudent
);

// Batch audit all students in group consideration (TG, HOD, Admin)
router.patch(
  '/:id/audit-all',
  authorize('TG', 'HOD', 'ADMIN'),
  validateBody(auditAllStudentsSchema),
  considerationsController.auditAllGroupStudents
);

export default router;
