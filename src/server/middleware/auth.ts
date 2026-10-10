import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.ts';
import { User, type IUser, type UserRole } from '../models/User.ts';
import { AppError } from './errorHandler.ts';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export interface JwtPayload {
  id: string;
  role: UserRole;
  email: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new AppError('Authentication required. Please sign in to access this resource.', 401);
    }

    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User belonging to this token no longer exists.', 401);
    }

    if (user.status === 'suspended') {
      throw new AppError('Your account has been suspended. Please contact an administrator.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required before authorization check.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: You do not have permission to perform this action. Required role: ${allowedRoles.join(' or ')}`,
          403
        )
      );
    }

    next();
  };
}
