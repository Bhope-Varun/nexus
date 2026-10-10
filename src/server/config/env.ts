import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  mongodbUri:
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/nexus_corporate',
  jwtSecret:
    process.env.JWT_SECRET || 'nexus_corporate_jwt_super_secret_key_minimum_32_characters_default',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Stripe Configuration
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_nexus_corp',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder_secret_for_nexus_corp',

  // Email / SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Nexus Corporate Billing <billing@nexuscorporate.com>',
  },

  // Storage Configuration
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 'cloud',
    receiptsDir: process.env.RECEIPTS_DIR || './uploads/receipts',
  },
};
