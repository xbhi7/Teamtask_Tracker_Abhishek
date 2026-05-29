import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors';
import prisma from '../config/db';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sde2-takehome-teamtask-access-secret-key-1298471';

interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    throw new UnauthorizedError('Authentication token required');
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
};

export const requireRoles = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('You do not have the required permissions to perform this action');
    }

    next();
  };
};

export const authorizeTaskAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const taskId = req.params.id;
  if (!taskId) {
    return next();
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Tenant Isolation check: Verify the task belongs to the user's organization!
    if (task.organizationId !== req.user.organizationId) {
      throw new ForbiddenError('Access denied: Task belongs to a different organization');
    }

    // Role specific check:
    // ADMIN / MANAGER: full access to all tasks in organization
    // MEMBER: can only view/update tasks assigned to them
    if (req.user.role === Role.MEMBER) {
      if (task.assigneeId !== req.user.id) {
        throw new ForbiddenError('Access denied: You can only view or update tasks assigned to you');
      }
    }

    // Store the task on request for potential reuse in the controller to avoid dual queries!
    (req as any).task = task;

    next();
  } catch (err) {
    next(err);
  }
};
