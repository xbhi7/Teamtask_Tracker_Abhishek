import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { Role } from '@prisma/client';
import * as taskController from '../controllers/task.controller';
import { authenticateToken, requireRoles, authorizeTaskAccess } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// All task routes require authentication
router.use(authenticateToken);

router.post(
  '/',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  [
    body('title').notEmpty().withMessage('Title is required').trim(),
    body('description').optional().trim(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority value'),
    body('assigneeId').optional().isUUID().withMessage('Invalid assignee UUID'),
    body('projectId').optional().isUUID().withMessage('Invalid project UUID'),
    body('dueDate').notEmpty().withMessage('dueDate is required').isISO8601().withMessage('dueDate must be a valid ISO8601 date'),
    validateRequest,
  ],
  taskController.createTask
);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
    query('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']).withMessage('Invalid status filter'),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority filter'),
    query('assigneeId').optional().isUUID().withMessage('Invalid assignee filter UUID'),
    validateRequest,
  ],
  taskController.listTasks
);

router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid task ID format'),
    validateRequest,
    authorizeTaskAccess,
  ],
  taskController.getTaskById
);

router.patch(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid task ID format'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty').trim(),
    body('description').optional().trim(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority value'),
    body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']).withMessage('Invalid status value'),
    body('assigneeId').optional().custom((val) => val === null || typeof val === 'string').withMessage('Invalid assignee ID'),
    body('projectId').optional().custom((val) => val === null || typeof val === 'string').withMessage('Invalid project ID'),
    body('dueDate').optional().isISO8601().withMessage('dueDate must be a valid ISO8601 date'),
    validateRequest,
    authorizeTaskAccess,
  ],
  taskController.updateTask
);

router.delete(
  '/:id',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  [
    param('id').isUUID().withMessage('Invalid task ID format'),
    validateRequest,
    authorizeTaskAccess,
  ],
  taskController.deleteTask
);

export default router;
