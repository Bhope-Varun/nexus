import { Router } from 'express';
import { getDbState } from '../config/db.ts';

const router = Router();

router.get('/', (_req, res) => {
  const dbStatus = getDbState();

  res.status(200).json({
    success: true,
    service: 'Nexus Corporate Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

export default router;
