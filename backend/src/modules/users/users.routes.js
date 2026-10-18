import { Router } from 'express';
import usersController from './users.controller.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';

const router = Router();

// All routes require authentication
router.use(auth);

// ADMIN and HOD have full user management access
router.get('/', authorize('ADMIN', 'HOD'), usersController.listUsers);
router.post('/', authorize('ADMIN'), usersController.createUser);
router.get('/:id', authorize('ADMIN', 'HOD', 'TG'), usersController.getUserById);
router.patch('/:id', authorize('ADMIN', 'HOD'), usersController.updateUser);
// TG can reset passwords for their mentees, ADMIN/HOD for any user
router.post('/:id/reset-password', authorize('ADMIN', 'HOD', 'TG'), usersController.resetPassword);
router.patch('/:id/status', authorize('ADMIN', 'HOD'), usersController.updateStatus);
router.delete('/:id', authorize('ADMIN'), usersController.deleteUser);
router.post('/:id/appoint-hod', authorize('ADMIN'), usersController.appointHOD);
router.post('/:id/remove-hod', authorize('ADMIN'), usersController.removeHOD);
router.post('/:id/appoint-tg', authorize('ADMIN', 'HOD'), usersController.appointTG);
router.post('/:id/remove-tg', authorize('ADMIN', 'HOD'), usersController.removeTG);

export default router;

