import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 checkout sessions per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many payment checkout attempts from this IP. Please try again after 15 minutes.',
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many requests. Please slow down and try again later.',
  },
});
