import * as fingerprintService from '../services/fingerprint.service.js';
import * as logService from '../services/log.service.js';

const checkHealth = async (req, res) => {
    try {
        const stats = await fingerprintService.calculateStats();
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            storage: {
                type: logService.isDatabaseStorage()
                    ? 'PostgreSQL with JSON file fallback'
                    : 'JSON file',
                ...stats
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'degraded',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            storage: {
                type: logService.isDatabaseStorage()
                    ? 'PostgreSQL with JSON file fallback'
                    : 'JSON file',
                status: 'error',
                error: 'Storage check failed'
            }
        });
    }
};

export { checkHealth };
