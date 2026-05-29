import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { ConflictError } from '../utils/errors';

export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = req.user!;

  try {
    const projects = await prisma.project.findMany({
      where: { organizationId: currentUser.organizationId },
      orderBy: { name: 'asc' },
    });

    res.status(200).json(projects);
  } catch (err) {
    next(err);
  }
};

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = req.user!;
  const { name, description } = req.body;

  try {
    const existingProject = await prisma.project.findFirst({
      where: { name, organizationId: currentUser.organizationId },
    });

    if (existingProject) {
      throw new ConflictError('A project with this name already exists in your organization');
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        organizationId: currentUser.organizationId,
      },
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

export const listMembers = async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = req.user!;

  try {
    const members = await prisma.user.findMany({
      where: { organizationId: currentUser.organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });

    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
};
