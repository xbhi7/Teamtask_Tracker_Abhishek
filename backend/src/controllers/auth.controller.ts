import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, firstName, lastName, role, organizationId, organizationName } = req.body;

  try {
    // 1. Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('Email address is already registered');
    }

    // 2. Resolve organization
    let resolvedOrgId = organizationId;

    if (!resolvedOrgId) {
      if (!organizationName) {
        throw new ConflictError('Either organizationId or organizationName must be provided');
      }
      
      const newOrg = await prisma.organization.create({
        data: { name: organizationName },
      });
      resolvedOrgId = newOrg.id;
    } else {
      const orgExists = await prisma.organization.findUnique({
        where: { id: resolvedOrgId },
      });
      if (!orgExists) {
        throw new NotFoundError('Organization not found');
      }
    }

    // 3. Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Create User
    const userRole = role || 'MEMBER';
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: userRole,
        organizationId: resolvedOrgId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  try {
    // 1. Find user and include organization details
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Compare passwords
    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Generate tokens
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 4. Save refresh token to DB
    const decodedRefresh = verifyRefreshToken(refreshToken) as any;
    const expiresAt = new Date(decodedRefresh.exp * 1000);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // 5. Respond
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token is required');
  }

  try {
    // 1. Verify token structure/expiry using JWT
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 2. Query the refresh token from database
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    // 3. RTR Theft Detection: If token is not found or is already revoked
    if (!dbToken || dbToken.isRevoked || dbToken.expiresAt < new Date()) {
      if (dbToken && dbToken.isRevoked) {
        console.warn(`🚨 REUSE DETECTED: Refresh token was already used! Revoking all sessions for user ${payload.id}`);
        // Revoke all tokens for this user!
        await prisma.refreshToken.updateMany({
          where: { userId: payload.id },
          data: { isRevoked: true },
        });
      }
      throw new UnauthorizedError('Refresh token invalid, revoked, or expired');
    }

    // 4. Rotate: Revoke the current token
    await prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { isRevoked: true },
    });

    // 5. Generate new access & refresh tokens
    const tokenPayload = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // 6. Save the new refresh token
    const decodedRefresh = verifyRefreshToken(newRefreshToken) as any;
    const expiresAt = new Date(decodedRefresh.exp * 1000);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: payload.id,
        expiresAt,
      },
    });

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      // Mark token as revoked
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
