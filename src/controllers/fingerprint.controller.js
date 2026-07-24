import * as fingerprintService from '../services/fingerprint.service.js';
import * as logService from '../services/log.service.js';
import config from '../config/index.js';
import { FingerprintValidationError, isPlainObject } from '../services/fingerprint-validation.js';

const collectFingerprint = async (req, res) => {
    try {
        const fingerprintData = req.body;

        if (!fingerprintData || typeof fingerprintData !== 'object' || Array.isArray(fingerprintData)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid fingerprint payload'
            });
        }

        const { fingerprintId, sessionId, sessionCount, logEntry } =
            await fingerprintService.recordFingerprint(fingerprintData);

        console.log(`Fingerprint logged: ${fingerprintId.substring(0, 16)}...`);
        console.log(`Session ID: ${sessionId}`);

        res.json({
            success: true,
            fingerprintId: fingerprintId,
            sessionId: sessionId,
            isReturningUser: sessionCount > 1,
            sessionsCount: sessionCount,
            timestamp: logEntry.serverTimestamp
        });

    } catch (error) {
        console.error('Error processing fingerprint:', error);
        res.status(error instanceof FingerprintValidationError ? 400 : 500).json({
            success: false,
            error: error instanceof FingerprintValidationError
                ? error.message
                : 'Failed to process fingerprint'
        });
    }
};

const getFingerprint = async (req, res) => {
    try {
        if (!/^[a-f0-9]{64}$/i.test(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid fingerprint ID' });
        }
        const fingerprint = await fingerprintService.getFingerprintById(req.params.id);

        if (fingerprint) {
            res.json(fingerprint);
        } else {
            res.status(404).json({
                success: false,
                error: 'Fingerprint not found'
            });
        }
    } catch (error) {
        console.error('Error getting fingerprint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve fingerprint'
        });
    }
};

const compareFingerprints = (req, res) => {
    const { fingerprint1, fingerprint2 } = req.body || {};

    if (!isPlainObject(fingerprint1) || !isPlainObject(fingerprint2)) {
        return res.status(400).json({
            success: false,
            error: 'Two fingerprints required for comparison'
        });
    }

    const comparison = fingerprintService.compareFingerprints(fingerprint1, fingerprint2);

    res.json({
        success: true,
        ...comparison
    });
};

const getStats = async (req, res) => {
    try {
        const stats = await fingerprintService.calculateStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics'
        });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const stats = await fingerprintService.calculateStats();
        const logs = await logService.readLogs();

        res.json({
            ...stats,
            recentFingerprints: logs.slice(-10).map(fp => ({
                id: typeof fp.id === 'string' ? fp.id.substring(0, 16) + '...' : 'unknown',
                timestamp: fp.serverTimestamp
            })),
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve analytics'
        });
    }
};

const getConfig = (req, res) => {
    res.json({
        features: config.features,
        api: {
            version: config.api.version,
            timeout: config.api.timeout
        },
        environment: config.server.nodeEnv
    });
};

export {
    collectFingerprint,
    getFingerprint,
    compareFingerprints,
    getStats,
    getAnalytics,
    getConfig
};
