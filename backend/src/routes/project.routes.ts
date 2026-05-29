import { Router } from 'express';
import { body } from 'express-validator';
import { Role } from '@prisma/client';
import * as projectController from '../controllers/project.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// All project routes require authentication
router.use(authenticateToken);

router.get('/', projectController.listProjects);

router.post(
  '/',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  [
    body('name').notEmpty().withMessage('Project name is required').trim(),
    body('description').optional().trim(),
    validateRequest,
  ],
  projectController.createProject
);

// Route to fetch organization members
router.get('/members', projectController.listMembers);

export default router;
