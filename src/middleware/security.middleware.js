import config from '../config/index.js';

const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.security.enableCoopCoep) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }
    if (req.path.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
    }
    next();
};

// O limite é local ao processo e não é compartilhado entre instâncias.
const createRateLimiter = (options = {}) => {
    const enabled = options.enabled ?? config.security.rateLimit.enabled;
    if (!enabled) {
        return (req, res, next) => next();
    }

    const hits = new Map();
    const windowMs = options.windowMs ?? config.security.rateLimit.windowMs;
    const maxRequests = options.maxRequests ?? config.security.rateLimit.maxRequests;
    const errorMessage = options.errorMessage || 'Too many requests from this IP';
    let requestsSinceCleanup = 0;

    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip || req.connection?.remoteAddress || 'unknown';
        const history = hits.get(key) || [];
        const recent = history.filter(timestamp => now - timestamp < windowMs);

        if (recent.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: errorMessage
            });
        }

        recent.push(now);
        hits.set(key, recent);
        requestsSinceCleanup += 1;

        // Evita crescimento ilimitado do mapa quando muitos IPs distintos acessam o processo.
        if (requestsSinceCleanup >= 1000) {
            for (const [storedKey, timestamps] of hits) {
                if (!timestamps.some(timestamp => now - timestamp < windowMs)) {
                    hits.delete(storedKey);
                }
            }
            requestsSinceCleanup = 0;
        }
        next();
    };
};

export { securityHeaders, createRateLimiter };
