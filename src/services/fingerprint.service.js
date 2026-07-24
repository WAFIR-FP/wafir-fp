import crypto from 'crypto';
import FingerprintMatcher from '../fingerprint-matcher/index.js';
import * as logService from './log.service.js';
import { normalizeFingerprintSubmission } from './fingerprint-validation.js';

const createRecordId = () => crypto.randomBytes(32).toString('hex');
const createSessionId = (sessionId) => sessionId || crypto.randomBytes(16).toString('hex');
const getUnavailableFields = browser => new Set(
    Array.isArray(browser?.unavailable_fields) ? browser.unavailable_fields : []
);
const getCollectionStatus = (fingerprint, component) =>
    fingerprint?.collection_status?.[component] || null;

const buildLogEntry = (submission, sessionId, recordId) => ({
    id: recordId,
    sessionId,
    serverTimestamp: new Date().toISOString(),
    cpp_fingerprint: submission.cppFingerprint,
    js_fingerprint: submission.jsFingerprint,
    clientTimestamp: submission.clientTimestamp
});

const recordFingerprint = async (fingerprintData) => {
    const submission = normalizeFingerprintSubmission(fingerprintData);
    const sessionId = createSessionId(submission.sessionId);
    const fingerprintId = createRecordId();
    const logEntry = buildLogEntry(submission, sessionId, fingerprintId);

    await logService.appendLog(logEntry);
    const sessionCount = await logService.countLogsByFingerprintHash(
        submission.cppFingerprint.fingerprint_hash
    );

    return { fingerprintId, sessionId, sessionCount, logEntry };
};

const getFingerprintById = async (id) => {
    const logs = await logService.readLogs();
    return logs.find(log => log.id === id) || null;
};

const compareFingerprints = (fingerprint1, fingerprint2) => {
    const matcher = new FingerprintMatcher();
    const { similarity, coverage } = matcher.calculateSimilarityDetails(fingerprint1, fingerprint2);
    const browser1 = fingerprint1.browser_fingerprint || fingerprint1.browser_info || {};
    const browser2 = fingerprint2.browser_fingerprint || fingerprint2.browser_info || {};
    const canvasComparable = hasComparableHash(fingerprint1.canvas_fingerprint, fingerprint2.canvas_fingerprint);
    const audioComparable = hasComparableHash(fingerprint1.audio_fingerprint, fingerprint2.audio_fingerprint);
    const webglComparable = matcher.hasComparableWebGL(
        fingerprint1.webgl_fingerprint,
        fingerprint2.webgl_fingerprint
    );
    const browserComparable = matcher.hasComparableBrowserFields(browser1, browser2);
    const browser1Unavailable = getUnavailableFields(browser1);
    const browser2Unavailable = getUnavailableFields(browser2);
    const hardwareComparable = browser1.available !== false && browser2.available !== false &&
        !browser1Unavailable.has('hardware_concurrency') &&
        !browser2Unavailable.has('hardware_concurrency') &&
        Number.isFinite(browser1.hardware_concurrency) && browser1.hardware_concurrency > 0 &&
        Number.isFinite(browser2.hardware_concurrency) && browser2.hardware_concurrency > 0;
    const componentComparability = {
        canvas: canvasComparable,
        webgl: webglComparable,
        audio: audioComparable,
        browser: browserComparable
    };
    const excludedComponents = Object.entries(componentComparability)
        .filter(([, comparable]) => !comparable)
        .map(([component]) => ({
            component,
            fingerprint1: getCollectionStatus(fingerprint1, component),
            fingerprint2: getCollectionStatus(fingerprint2, component)
        }));

    return {
        isMatch: coverage >= matcher.thresholds.minimum_coverage && similarity >= matcher.thresholds.same_device,
        similarity: `${(similarity * 100).toFixed(1)}%`,
        similarityScore: similarity,
        coverage,
        confidence: matcher.getMatchConfidence(similarity, coverage),
        details: {
            canvas: canvasComparable
                ? Number(fingerprint1.canvas_fingerprint.hash === fingerprint2.canvas_fingerprint.hash)
                : 0,
            webgl: matcher.compareWebGL(fingerprint1.webgl_fingerprint || {}, fingerprint2.webgl_fingerprint || {}),
            browser: matcher.compareBrowserFingerprint(browser1, browser2),
            hardware: hardwareComparable
                ? Number(browser1.hardware_concurrency === browser2.hardware_concurrency)
                : 0
        },
        thresholds: {
            sameDevice: '85%+',
            likely: '75-85%',
            possible: '65-75%',
            different: '<65%',
            minimumCoverage: '50%'
        },
        diagnostics: {
            excludedComponents,
            unavailableBrowserFields: {
                fingerprint1: [...browser1Unavailable],
                fingerprint2: [...browser2Unavailable]
            }
        }
    };
};

const hasComparableHash = (left, right) =>
    left?.available !== false && right?.available !== false &&
    typeof left?.hash === 'string' && left.hash.length > 0 &&
    typeof right?.hash === 'string' && right.hash.length > 0;

const calculateStats = async () => {
    const logs = await logService.readLogs();
    const matcher = new FingerprintMatcher();
    const stats = matcher.calculateStatistics(logs);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentActivity = logs.filter(entry => {
        const timestamp = Date.parse(entry.serverTimestamp || entry.clientTimestamp);
        return Number.isFinite(timestamp) && timestamp > dayAgo;
    }).length;

    return {
        totalFingerprints: stats.totalFingerprints,
        uniqueFingerprints: stats.uniqueDevices,
        totalSessions: stats.totalSessions,
        returningUsers: stats.returningDevices,
        averageSessionsPerFingerprint: stats.averageCollectionsPerDevice,
        recentActivity,
        deviceGroups: stats.deviceGroups
    };
};

export {
    calculateStats,
    recordFingerprint,
    getFingerprintById,
    compareFingerprints
};
