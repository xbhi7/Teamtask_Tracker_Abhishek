import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If the error is a known application error
  if (err instanceof AppError) {
    return res.status(err.status).json({
      status: err.status,
      code: err.code,
      message: err.message,
    });
  }

  // Handle express-validator or generic validation error structures
  if ('errors' in err && Array.isArray((err as any).errors)) {
    const validationErrors = (err as any).errors;
    const firstErrorMessage = validationErrors[0]?.msg || 'Validation failed';
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: firstErrorMessage,
    });
  }

  // Fallback for unhandled/internal server errors
  console.error('💥 Unhandled Exception:', err);
  
  return res.status(500).json({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong on the server',
  });
};
