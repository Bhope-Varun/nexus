import path from 'path';
import express from 'express';
import { app } from './src/server/app.ts';
import { connectDB } from './src/server/config/db.ts';
import { config } from './src/server/config/env.ts';

async function startServer() {
  // 1. Connect to MongoDB Atlas
  console.log('[Nexus Corporate] Initializing MongoDB connection...');
  const conn = await connectDB();
  if (conn) {
    const { seedInitialData } = await import('./src/server/config/seed.ts');
    await seedInitialData();
  }

  // 2. In development, mount Vite dev middleware
  if (config.env !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built Vite static assets
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 3. Start listening on PORT (3000)
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Nexus Corporate] Server running in ${config.env} mode on port ${config.port}`);
    console.log(`[Nexus Corporate] API Health available at http://localhost:${config.port}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[Nexus Corporate] Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      const { disconnectDB } = await import('./src/server/config/db.ts');
      await disconnectDB();
      console.log('[Nexus Corporate] Server shut down cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Nexus Corporate] Fatal startup error:', err);
  process.exit(1);
});
