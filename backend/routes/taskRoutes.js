import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  setTaskCompleted,
  updateTask
} from '../controllers/taskController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const router = Router();

router.use(authenticateToken);
router.post('/', asyncHandler(createTask));
router.get('/', asyncHandler(getTasks));
router.get('/:id', asyncHandler(getTask));
router.put('/:id', asyncHandler(updateTask));
router.patch('/:id/complete', asyncHandler(setTaskCompleted));
router.delete('/:id', asyncHandler(deleteTask));

export default router;
