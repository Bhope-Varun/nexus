import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.ts';
import invoiceRoutes from './routes/invoice.routes.ts';
import paymentRoutes from './routes/payment.routes.ts';
import healthRoutes from './routes/health.routes.ts';
import cookieParser from 'cookie-parser';
import { downloadReceipt } from './controllers/payment.controller.ts';
import { authenticateToken } from './middleware/auth.ts';
import { apiLimiter } from './middleware/rateLimiter.ts';
import { errorHandler, AppError } from './middleware/errorHandler.ts';
import { config } from './config/env.ts';

export function createApp(): express.Application {
  const app = express();

  // Security Middleware: Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Vite inline scripts and React Dev during development
      crossOriginEmbedderPolicy: false,
    })
  );

  // Secure CORS Configuration:
  // Allow credentials (HttpOnly cookies) in dev/local environments and for matched origins
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);

        // In test or development mode, allow localhost and dev origins
        if (!config.isProduction) return callback(null, true);

        // In production, allow specified origin or appUrl
        if (config.corsOrigin === '*' || origin === config.appUrl || origin === config.corsOrigin) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    })
  );

  // Cookie Parser
  app.use(cookieParser());

  // Request Body Parsers:
  // CRITICAL: Preserve rawBody as Buffer for Stripe Webhook Signature Verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // General API Rate Limiting (disabled in test mode; skip webhook)
  if (!config.isTest) {
    app.use('/api', (req, res, next) => {
      // Never rate-limit Stripe webhook callbacks
      if (req.path.startsWith('/payments/webhook')) {
        return next();
      }
      return apiLimiter(req, res, next);
    });
  }

  // API Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/payments', paymentRoutes);
  app.get('/api/receipts/download/:filename', authenticateToken, downloadReceipt);

  // 404 handler for unmatched API routes
  app.all('/api/*', (req, _res, next) => {
    next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404));
  });

  // Global Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
