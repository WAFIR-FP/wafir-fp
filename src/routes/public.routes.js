import express from 'express';
import * as publicController from '../controllers/public.controller.js';

const router = express.Router();

router.get('/', publicController.renderHome);
router.get('/sobre', publicController.renderSobre);
router.get('/coleta-fingerprint', publicController.renderColetaFingerprint);
router.get('/test-stats', publicController.renderTestStats);

// Mantém URLs antigas funcionando.
router.get('/index.html', publicController.redirectLegacyHome);
router.get('/sobre.html', publicController.redirectLegacySobre);
router.get('/coleta-fingerprint.html', publicController.redirectLegacyColetaFingerprint);
router.get('/test-stats.html', publicController.redirectLegacyTestStats);

export default router;
