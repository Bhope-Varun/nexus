import type { Request, Response } from 'express';
import { User, type UserRole } from '../models/User.ts';
import { AppError, catchAsync } from '../middleware/errorHandler.ts';
import { generateToken } from '../middleware/auth.ts';

import { config } from '../config/env.ts';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
});

export const register = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password, companyName, phone, role } = req.body;

  // Check for existing user
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('An account with this email address already exists', 409);
  }

  // Privilege escalation prevention:
  // Public registration can only create 'client' role.
  // Only an authenticated admin can provision 'staff' or 'admin' accounts.
  let assignedRole: UserRole = 'client';
  if (role && req.user && req.user.role === 'admin') {
    assignedRole = role;
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: assignedRole,
    companyName,
    phone,
  });

  const token = generateToken({
    id: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  res.cookie('token', token, getCookieOptions());

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.status === 'suspended') {
    throw new AppError('Your account has been suspended. Please contact administrator.', 403);
  }

  const token = generateToken({
    id: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  res.cookie('token', token, getCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
});

export const logout = catchAsync(async (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

export const updateMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const { name, companyName, phone } = req.body;

  if (name !== undefined) user.name = name;
  if (companyName !== undefined) user.companyName = companyName;
  if (phone !== undefined) user.phone = phone;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      phone: user.phone,
      status: user.status,
    },
  });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!._id).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { currentPassword, newPassword } = req.body;
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { role, status, search, page = '1', limit = '20' } = req.query;

  const query: Record<string, any> = {};
  if (role && typeof role === 'string') query.role = role;
  if (status && typeof status === 'string') query.status = status;
  if (search && typeof search === 'string') {
    const safeSearch = escapeRegex(search.trim());
    query.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } },
      { companyName: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    User.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
});
