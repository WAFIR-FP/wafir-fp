import express from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import { createRateLimiter } from '../middleware/security.middleware.js';
import config from '../config/index.js';

const router = express.Router();
const loginRateLimiter = createRateLimiter({
    enabled: true,
    windowMs: config.security.admin.loginWindowMs,
    maxRequests: config.security.admin.loginMaxAttempts,
    errorMessage: 'Too many login attempts. Try again later.'
});

router.get('/login', adminController.renderLogin);
router.post('/verify', loginRateLimiter, adminController.verifyLogin);
router.post('/logout', adminController.logout);

router.get('/', adminController.redirectToLogin);
router.get('/dashboard', authenticateAdmin, adminController.renderDashboard);
router.post('/reset', authenticateAdmin, adminController.resetLogs);
router.get('/logs/download', authenticateAdmin, adminController.downloadLogs);
router.get('/logs/view', authenticateAdmin, adminController.viewLogs);

export default router;
