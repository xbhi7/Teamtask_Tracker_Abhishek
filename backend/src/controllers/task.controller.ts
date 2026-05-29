import { Request, Response, NextFunction } from 'express';
import { Role, TaskStatus, Priority } from '@prisma/client';
import prisma from '../config/db';
import { getTasksCache, setTasksCache, invalidateTasksCache } from '../services/cache.service';
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/errors';
import { isValidTransition } from '../utils/statusTransitions';

export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  const { title, description, priority, assigneeId, projectId, dueDate } = req.body;
  const currentUser = req.user!;

  try {
    // Validate target due date
    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime()) || parsedDueDate <= new Date()) {
      throw new ValidationError('due_date must be a future date');
    }

    // Ensure assignee belongs to the same tenant organization
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeId, organizationId: currentUser.organizationId },
      });
      if (!assignee) {
        throw new ValidationError('Assignee must be a valid user in your organization');
      }
    }

    // Ensure project belongs to the same tenant organization
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId: currentUser.organizationId },
      });
      if (!project) {
        throw new ValidationError('Project must be a valid project in your organization');
      }
    }

    // Insert task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || Priority.MEDIUM,
        status: TaskStatus.TODO,
        assigneeId: assigneeId || null,
        projectId: projectId || null,
        creatorId: currentUser.id,
        dueDate: parsedDueDate,
        organizationId: currentUser.organizationId,
      },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Clear assignee task list cache
    if (assigneeId) {
      await invalidateTasksCache(assigneeId);
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

export const listTasks = async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = req.user!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as TaskStatus | undefined;
  const priority = req.query.priority as Priority | undefined;
  
  // MEMBER restriction: Member can only view their own tasks
  let assigneeId = req.query.assigneeId as string | undefined;
  if (currentUser.role === Role.MEMBER) {
    assigneeId = currentUser.id;
  }

  const skip = (page - 1) * limit;

  const whereClause: any = {
    organizationId: currentUser.organizationId,
  };

  if (assigneeId) {
    whereClause.assigneeId = assigneeId;
  }
  if (status) {
    whereClause.status = status;
  }
  if (priority) {
    whereClause.priority = priority;
  }

  try {
    // Base assignee queries (limit=100, page=1, no filters) are cache targets for the Kanban board
    const isBaseAssigneeQuery = assigneeId && !status && !priority && page === 1 && limit === 100;

    if (isBaseAssigneeQuery) {
      const cachedTasks = await getTasksCache(assigneeId!);
      if (cachedTasks) {
        return res.status(200).json({
          tasks: cachedTasks,
          page,
          limit,
          total: cachedTasks.length,
          cached: true,
        });
      }
    }

    const [tasks, total] = await prisma.$transaction([
      prisma.task.findMany({
        where: whereClause,
        include: {
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.task.count({ where: whereClause }),
    ]);

    if (isBaseAssigneeQuery && tasks.length > 0) {
      await setTasksCache(assigneeId!, tasks);
    }

    res.status(200).json({
      tasks,
      page,
      limit,
      total,
      cached: false,
    });
  } catch (err) {
    next(err);
  }
};

export const getTaskById = async (req: Request, res: Response, next: NextFunction) => {
  // Task is already fetched in authorizeTaskAccess middleware!
  const task = (req as any).task;
  
  // We want to return task with populated assignee and project
  try {
    const fullTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(200).json(fullTask);
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  const existingTask = (req as any).task; // Pre-fetched in authorizeTaskAccess middleware
  const currentUser = req.user!;
  const { title, description, priority, assigneeId, projectId, dueDate, status } = req.body;

  try {
    // Members can only update their own status
    if (currentUser.role === Role.MEMBER) {
      const keys = Object.keys(req.body).filter(k => req.body[k] !== undefined);
      const containsOtherFields = keys.some(k => k !== 'status');
      if (containsOtherFields) {
        throw new ForbiddenError('Members can only update the status of their assigned tasks');
      }
    }

    let parsedDueDate = existingTask.dueDate;
    if (dueDate !== undefined) {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime()) || parsedDueDate <= new Date()) {
        throw new ValidationError('due_date must be a future date');
      }
    }

    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId) {
      if (assigneeId !== null) {
        const assignee = await prisma.user.findFirst({
          where: { id: assigneeId, organizationId: currentUser.organizationId },
        });
        if (!assignee) {
          throw new ValidationError('Assignee must be a valid user in your organization');
        }
      }
    }

    if (projectId !== undefined && projectId !== existingTask.projectId) {
      if (projectId !== null) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, organizationId: currentUser.organizationId },
        });
        if (!project) {
          throw new ValidationError('Project must be a valid project in your organization');
        }
      }
    }

    if (status !== undefined && status !== existingTask.status) {
      if (!isValidTransition(existingTask.status, status)) {
        throw new ValidationError(`Invalid status transition from ${existingTask.status} to ${status}`);
      }

      // Check transition permissions
      if (currentUser.role === Role.MEMBER && existingTask.assigneeId !== currentUser.id) {
        throw new ForbiddenError("Only the task's assignee can advance its status");
      }
    }

    const oldAssigneeId = existingTask.assigneeId;

    // 6. Update in database
    const updatedTask = await prisma.task.update({
      where: { id: existingTask.id },
      data: {
        title: title !== undefined ? title : existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        priority: priority !== undefined ? priority : existingTask.priority,
        status: status !== undefined ? status : existingTask.status,
        assigneeId: assigneeId !== undefined ? assigneeId : existingTask.assigneeId,
        projectId: projectId !== undefined ? projectId : existingTask.projectId,
        dueDate: parsedDueDate,
      },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Clear old/new assignee cache keys
    if (oldAssigneeId) {
      await invalidateTasksCache(oldAssigneeId);
    }
    if (assigneeId && assigneeId !== oldAssigneeId) {
      await invalidateTasksCache(assigneeId);
    }

    res.status(200).json(updatedTask);
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req: Request, res: Response, next: NextFunction) => {
  const existingTask = (req as any).task; // Pre-fetched in authorizeTaskAccess middleware

  try {
    // Delete task from DB
    await prisma.task.delete({
      where: { id: existingTask.id },
    });

    // Invalidate cache for the assignee
    if (existingTask.assigneeId) {
      await invalidateTasksCache(existingTask.assigneeId);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
