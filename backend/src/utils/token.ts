import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sde2-takehome-teamtask-access-secret-key-1298471';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sde2-takehome-teamtask-refresh-secret-key-1298471';
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION } as any);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const noncePayload = {
    ...payload,
    jti: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  };
  return jwt.sign(noncePayload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION } as any);
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};
