const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const SESSION_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
const MAX_CANVAS_VALUE_LENGTH = 1_500_000;

class FingerprintValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FingerprintValidationError';
        this.statusCode = 400;
    }
}

const isPlainObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const requireObject = (value, fieldName) => {
    if (!isPlainObject(value)) {
        throw new FingerprintValidationError(`${fieldName} must be an object`);
    }
};

const requireHash = (value, fieldName) => {
    if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
        throw new FingerprintValidationError(`${fieldName} must be a SHA-256 hexadecimal hash`);
    }
};

const validateFingerprint = (fingerprint, fieldName = 'fingerprint') => {
    requireObject(fingerprint, fieldName);
    requireHash(fingerprint.fingerprint_hash, `${fieldName}.fingerprint_hash`);

    requireObject(fingerprint.canvas_fingerprint, `${fieldName}.canvas_fingerprint`);
    requireHash(fingerprint.canvas_fingerprint.hash, `${fieldName}.canvas_fingerprint.hash`);
    if (typeof fingerprint.canvas_fingerprint.data_url !== 'string' ||
        fingerprint.canvas_fingerprint.data_url.length > MAX_CANVAS_VALUE_LENGTH) {
        throw new FingerprintValidationError(`${fieldName}.canvas_fingerprint.data_url is invalid`);
    }

    requireObject(fingerprint.webgl_fingerprint, `${fieldName}.webgl_fingerprint`);
    requireHash(fingerprint.webgl_fingerprint.hash, `${fieldName}.webgl_fingerprint.hash`);

    requireObject(fingerprint.audio_fingerprint, `${fieldName}.audio_fingerprint`);
    requireHash(fingerprint.audio_fingerprint.hash, `${fieldName}.audio_fingerprint.hash`);

    requireObject(fingerprint.browser_fingerprint, `${fieldName}.browser_fingerprint`);
    return fingerprint;
};

const sanitizeCppFingerprint = (fingerprintData = {}) => {
    const sanitizedFingerprint = { ...fingerprintData };
    delete sanitizedFingerprint.deviceCategory;
    delete sanitizedFingerprint.device_category;
    delete sanitizedFingerprint.sessionId;
    delete sanitizedFingerprint.timestamp;
    delete sanitizedFingerprint.js_fingerprint;
    return sanitizedFingerprint;
};

const normalizeFingerprintSubmission = (payload) => {
    requireObject(payload, 'payload');

    const sessionId = payload.sessionId;
    if (sessionId !== undefined && sessionId !== null &&
        (typeof sessionId !== 'string' || !SESSION_PATTERN.test(sessionId))) {
        throw new FingerprintValidationError('sessionId has an invalid format');
    }

    if (payload.timestamp !== undefined && payload.timestamp !== null) {
        if (typeof payload.timestamp !== 'string' ||
            payload.timestamp.length > 100 ||
            Number.isNaN(Date.parse(payload.timestamp))) {
            throw new FingerprintValidationError('timestamp must be a valid date string');
        }
    }

    const cppFingerprint = sanitizeCppFingerprint(payload);
    validateFingerprint(cppFingerprint, 'fingerprint');

    const jsFingerprint = payload.js_fingerprint ?? null;
    if (jsFingerprint !== null) {
        validateFingerprint(jsFingerprint, 'js_fingerprint');
    }

    return {
        cppFingerprint,
        jsFingerprint,
        sessionId: sessionId || null,
        clientTimestamp: payload.timestamp || null
    };
};

export {
    FingerprintValidationError,
    isPlainObject,
    normalizeFingerprintSubmission,
    sanitizeCppFingerprint,
    validateFingerprint
};
