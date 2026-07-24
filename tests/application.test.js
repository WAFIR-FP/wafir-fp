import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import FingerprintMatcher from '../src/fingerprint-matcher/index.js';
import { AUDIO_FINGERPRINT_OPTIONS } from '../src/fingerprint/js/audioUtils.js';
import {
    FingerprintValidationError,
    normalizeFingerprintSubmission
} from '../src/services/fingerprint-validation.js';

const hash = character => character.repeat(64);
const makeFingerprint = (suffix = 'a') => ({
    fingerprint_hash: hash(suffix),
    canvas_fingerprint: {
        hash: hash(suffix),
        data_url: 'data:image/png;base64,AA=='
    },
    webgl_fingerprint: {
        hash: hash(suffix),
        vendor: 'Vendor',
        renderer: 'Renderer'
    },
    audio_fingerprint: {
        hash: hash(suffix),
        sample_rate: 44100,
        fingerprint_value: 1.25
    },
    browser_fingerprint: {
        hash: hash(suffix),
        platform: 'Linux x86_64',
        screen_resolution: '1920x1080',
        screen_width: 1920,
        screen_height: 1080,
        hardware_concurrency: 8,
        languages: ['pt-BR', 'pt'],
        fonts_available: ['Arial']
    }
});

test('o coletor de áudio analisa o buffer completo de 5.000 amostras', () => {
    assert.deepEqual(AUDIO_FINGERPRINT_OPTIONS, {
        sampleRate: 44100,
        frameSize: 5000,
        frameStart: 0,
        bufferLength: 5000
    });
});

test('a validação rejeita dados incompletos e separa os metadados', () => {
    assert.throws(
        () => normalizeFingerprintSubmission({}),
        FingerprintValidationError
    );

    const cpp = makeFingerprint('a');
    const js = makeFingerprint('b');
    const submission = normalizeFingerprintSubmission({
        ...cpp,
        sessionId: 'session-1',
        timestamp: '2026-07-22T12:00:00.000Z',
        js_fingerprint: js
    });

    assert.equal(submission.cppFingerprint.js_fingerprint, undefined);
    assert.equal(submission.cppFingerprint.sessionId, undefined);
    assert.equal(submission.cppFingerprint.timestamp, undefined);
    assert.deepEqual(submission.cppFingerprint.browser_fingerprint.fonts_available, ['Arial']);
    assert.equal(submission.cppFingerprint.browser_fingerprint.hash, hash('a'));
    assert.deepEqual(submission.jsFingerprint, js);
});

test('o comparador não considera valores ausentes como evidência', () => {
    const matcher = new FingerprintMatcher();
    const empty = {
        canvas_fingerprint: {},
        webgl_fingerprint: {},
        audio_fingerprint: {},
        browser_fingerprint: {}
    };

    assert.deepEqual(matcher.calculateSimilarityDetails(empty, empty), {
        similarity: 0,
        coverage: 0
    });
    assert.equal(matcher.isSameDevice(empty, empty), false);
    assert.equal(matcher.compareBrowserFingerprint({}, {}), 0);
    assert.equal(matcher.compareWebGL({}, {}), 0);
});

test('o comparador ignora fallbacks de componentes e campos indisponíveis do navegador', () => {
    const matcher = new FingerprintMatcher();
    const failed = {
        canvas_fingerprint: { hash: hash('a'), available: false },
        webgl_fingerprint: {
            hash: hash('a'),
            version: 'Unavailable',
            vendor: 'Unavailable',
            renderer: 'Unavailable',
            available: false
        },
        audio_fingerprint: { hash: hash('a'), available: false },
        browser_fingerprint: { platform: 'Unavailable', available: false }
    };

    assert.deepEqual(matcher.calculateSimilarityDetails(failed, failed), {
        similarity: 0,
        coverage: 0
    });

    const partialLeft = {
        browser_fingerprint: {
            platform: 'Linux x86_64',
            hardware_concurrency: -1,
            unavailable_fields: ['hardware_concurrency'],
            available: true
        }
    };
    const partialRight = {
        browser_fingerprint: {
            platform: 'Linux x86_64',
            hardware_concurrency: 32,
            unavailable_fields: ['hardware_concurrency'],
            available: true
        }
    };

    assert.deepEqual(matcher.calculateSimilarityDetails(partialLeft, partialRight), {
        similarity: 1,
        coverage: 0.45
    });
});

test('o comparador exige cobertura suficiente e utiliza os limites documentados', () => {
    const matcher = new FingerprintMatcher();
    const sparse = { canvas_fingerprint: { hash: hash('a') } };
    const sparseDetails = matcher.calculateSimilarityDetails(sparse, sparse);

    assert.equal(sparseDetails.similarity, 1);
    assert.equal(sparseDetails.coverage, 0.25);
    assert.equal(matcher.isSameDevice(sparse, sparse), false);
    assert.equal(matcher.getMatchConfidence(1, sparseDetails.coverage), 'insufficient');
    assert.deepEqual(matcher.weights, {
        canvas: 0.25,
        webgl: 0.20,
        audio: 0.10,
        browser: 0.45
    });
    assert.equal(matcher.thresholds.same_device, 0.85);
    assert.equal(matcher.thresholds.likely_same, 0.75);
    assert.equal(matcher.thresholds.possibly_same, 0.65);

    const complete = makeFingerprint('a');
    assert.equal(matcher.calculateSimilarity(complete, complete), 1);
    assert.equal(matcher.isSameDevice(complete, complete), true);
});

test('as estatísticas contabilizam sessões distintas separadamente dos dispositivos', () => {
    const matcher = new FingerprintMatcher();
    const fingerprint = makeFingerprint('a');
    const stats = matcher.calculateStatistics([
        { sessionId: 'one', serverTimestamp: '2026-01-01T00:00:00Z', cpp_fingerprint: fingerprint },
        { sessionId: 'two', serverTimestamp: '2026-01-02T00:00:00Z', cpp_fingerprint: fingerprint }
    ]);

    assert.equal(stats.totalFingerprints, 2);
    assert.equal(stats.totalSessions, 2);
    assert.equal(stats.uniqueDevices, 1);
    assert.equal(stats.returningDevices, 1);
});

const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'wasm-fingerprint-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_ENABLED = 'false';
process.env.DATA_DIR = dataDirectory;
const fingerprintService = await import('../src/services/fingerprint.service.js');
const logService = await import('../src/services/log.service.js');
const adminController = await import('../src/controllers/admin.controller.js');

after(async () => {
    await fs.rm(dataDirectory, { recursive: true, force: true });
});

test('a comparação informa os componentes ignorados por falha na coleta', () => {
    const left = makeFingerprint('a');
    const right = makeFingerprint('a');
    left.canvas_fingerprint.available = false;
    right.canvas_fingerprint.available = false;
    left.audio_fingerprint.available = false;
    right.audio_fingerprint.available = false;
    left.collection_status = {
        canvas: { status: 'error', error_code: 'CANVAS_SERIALIZATION_FAILED' },
        audio: { status: 'error', error_code: 'AUDIO_RENDER_FAILED' }
    };
    right.collection_status = left.collection_status;

    const comparison = fingerprintService.compareFingerprints(left, right);
    assert.deepEqual(
        comparison.diagnostics.excludedComponents.map(item => item.component),
        ['canvas', 'audio']
    );
    assert.equal(comparison.details.canvas, 0);
    assert.equal(comparison.coverage, 0.65);
});

test('a persistência em arquivo preserva coletas simultâneas e separa os dados JavaScript', async () => {
    const cpp = makeFingerprint('c');
    const js = makeFingerprint('d');
    const submissions = Array.from({ length: 12 }, (_, index) => ({
        ...cpp,
        sessionId: `session-${index}`,
        js_fingerprint: js
    }));

    const results = await Promise.all(
        submissions.map(submission => fingerprintService.recordFingerprint(submission))
    );
    const logs = await logService.readLogs();
    const persistedJson = JSON.parse(
        await fs.readFile(path.join(dataDirectory, 'fingerprints.json'), 'utf8')
    );

    assert.equal(new Set(results.map(result => result.fingerprintId)).size, submissions.length);
    assert.equal(logs.length, submissions.length);
    assert.equal(persistedJson.length, submissions.length);
    assert.equal(results.at(-1).sessionCount, submissions.length);
    assert.equal(logs[0].cpp_fingerprint.js_fingerprint, undefined);
    assert.deepEqual(logs[0].js_fingerprint, js);
});

test('o login administrativo mantém o token da sessão somente em cookie HttpOnly', () => {
    let cookie;
    let responseBody;
    const response = {
        cookie: (name, value, options) => { cookie = { name, value, options }; },
        json: body => { responseBody = body; },
        status: () => response
    };

    adminController.verifyLogin(
        { body: { username: 'admin', password: 'admin123' } },
        response
    );

    assert.equal(responseBody.success, true);
    assert.equal(responseBody.token, undefined);
    assert.equal(cookie.name, 'adminSession');
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, 'strict');
    assert.equal(cookie.options.path, '/admin');
});
