import express from 'express';
import fingerprintRoutes from './fingerprint.routes.js';
import adminRoutes from './admin.routes.js';
import healthRoutes from './health.routes.js';
import publicRoutes from './public.routes.js';

const router = express.Router();

router.use('/api', fingerprintRoutes);
router.use('/admin', adminRoutes);
router.use('/', publicRoutes);
router.use('/', healthRoutes);

export default router;
