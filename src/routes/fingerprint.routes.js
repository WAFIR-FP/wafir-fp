import express from 'express';
import * as fingerprintController from '../controllers/fingerprint.controller.js';

const router = express.Router();

router.post('/fingerprint', fingerprintController.collectFingerprint);
router.get('/fingerprint/:id', fingerprintController.getFingerprint);
router.post('/compare-fingerprints', fingerprintController.compareFingerprints);
router.get('/stats', fingerprintController.getStats);
router.get('/analytics', fingerprintController.getAnalytics);
router.get('/config', fingerprintController.getConfig);

export default router;
