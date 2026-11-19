import { Router } from 'express';
import {
  getAllTasks,
  getAllUsers,
  getDashboard,
  getUser,
  getUserTasks
} from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const router = Router();

router.use(authenticateToken, asyncHandler(requireAdmin));
router.get('/users', asyncHandler(getAllUsers));
router.get('/users/:id/tasks', asyncHandler(getUserTasks));
router.get('/users/:id', asyncHandler(getUser));
router.get('/tasks', asyncHandler(getAllTasks));
router.get('/dashboard', asyncHandler(getDashboard));

export default router;
