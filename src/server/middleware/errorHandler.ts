import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env.ts';

export class AppError extends Error {
  public statusCode: number;
  public status: 'fail' | 'error';
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    error.statusCode = 400;
    error.status = 'fail';
    error.message = 'Validation failed';
    error.details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }

  // 2. Mongoose Invalid ObjectId (CastError)
  if (err.name === 'CastError') {
    error.statusCode = 400;
    error.status = 'fail';
    error.message = `Invalid ${err.path}: ${err.value}`;
  }

  // 3. Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    error.statusCode = 409;
    error.status = 'fail';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const val = err.keyValue ? err.keyValue[field] : '';
    error.message = `Duplicate value for ${field}: "${val}". Please use another value.`;
  }

  // 4. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    error.statusCode = 400;
    error.status = 'fail';
    const errors = Object.values(err.errors || {}).map((e: any) => e.message);
    error.message = `Invalid input data. ${errors.join('. ')}`;
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.status = 'fail';
    error.message = 'Invalid authentication token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.status = 'fail';
    error.message = 'Authentication token has expired. Please log in again.';
  }

  let message = error.message || 'An unexpected error occurred';
  if (config.isProduction && error.statusCode === 500) {
    message = 'An internal server error occurred. Please contact support.';
  }

  const responsePayload: Record<string, any> = {
    success: false,
    status: error.status,
    message,
  };

  if (error.details) {
    responsePayload.details = error.details;
  }

  if (!config.isProduction && err.stack) {
    responsePayload.stack = err.stack;
  }

  res.status(error.statusCode).json(responsePayload);
}
