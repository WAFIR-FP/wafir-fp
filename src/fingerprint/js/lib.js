import { getBrowserFingerprint } from "./dom.js";
import { getCanvaFingerprint } from "./canva.js";
import { getWebGlFingerprint } from "./webgl.js";
import { getAudioFingerprint } from "./audio.js";
import { sha256Hex } from "./utils.js";

const UNAVAILABLE = "Unavailable";
const COLLECTOR_VERSION = "1.2";

function normalizeText(value, field, unavailableFields) {
    if (typeof value === "string" && value.trim() && value !== "Unknown" && value !== UNAVAILABLE) {
        return value;
    }
    unavailableFields.push(field);
    return UNAVAILABLE;
}

function normalizeNumber(value, field, unavailableFields, { positive = false, allowNegative = false } = {}) {
    const inAllowedRange = allowNegative || (positive ? value > 0 : value >= 0);
    if (Number.isFinite(value) && inAllowedRange) {
        return value;
    }
    unavailableFields.push(field);
    return -1;
}

function normalizeBoolean(value, field, unavailableFields) {
    if (typeof value === "boolean") {
        return value;
    }
    unavailableFields.push(field);
    return false;
}

function normalizeArray(value, field, unavailableFields) {
    if (Array.isArray(value)) {
        return value;
    }
    unavailableFields.push(field);
    return [];
}

function normalizeBrowserFingerprint(browser = {}) {
    const unavailableFields = [];
    const normalized = {
        user_agent: normalizeText(browser.user_agent, "user_agent", unavailableFields),
        language: normalizeText(browser.language, "language", unavailableFields),
        languages: normalizeArray(browser.languages, "languages", unavailableFields),
        platform: normalizeText(browser.platform, "platform", unavailableFields),
        vendor: normalizeText(browser.vendor, "vendor", unavailableFields),
        cookie_enabled: normalizeBoolean(browser.cookie_enabled, "cookie_enabled", unavailableFields),
        hardware_concurrency: normalizeNumber(browser.hardware_concurrency, "hardware_concurrency", unavailableFields, { positive: true }),
        max_touch_points: normalizeNumber(browser.max_touch_points, "max_touch_points", unavailableFields),
        screen_width: normalizeNumber(browser.screen_width, "screen_width", unavailableFields, { positive: true }),
        screen_height: normalizeNumber(browser.screen_height, "screen_height", unavailableFields, { positive: true }),
        screen_avail_width: normalizeNumber(browser.screen_avail_width, "screen_avail_width", unavailableFields, { positive: true }),
        screen_avail_height: normalizeNumber(browser.screen_avail_height, "screen_avail_height", unavailableFields, { positive: true }),
        screen_color_depth: normalizeNumber(browser.screen_color_depth, "screen_color_depth", unavailableFields, { positive: true }),
        screen_pixel_depth: normalizeNumber(browser.screen_pixel_depth, "screen_pixel_depth", unavailableFields, { positive: true }),
        screen_resolution: browser.screen_width > 0 && browser.screen_height > 0
            ? `${browser.screen_width}x${browser.screen_height}`
            : normalizeText(undefined, "screen_resolution", unavailableFields),
        pixel_ratio: normalizeNumber(browser.pixel_ratio, "pixel_ratio", unavailableFields, { positive: true }),
        inner_width: normalizeNumber(browser.inner_width, "inner_width", unavailableFields),
        inner_height: normalizeNumber(browser.inner_height, "inner_height", unavailableFields),
        outer_width: normalizeNumber(browser.outer_width, "outer_width", unavailableFields),
        outer_height: normalizeNumber(browser.outer_height, "outer_height", unavailableFields),
        timezone: normalizeText(browser.timezone, "timezone", unavailableFields),
        timezone_offset: normalizeNumber(browser.timezone_offset, "timezone_offset", unavailableFields, { allowNegative: true }),
        local_storage: normalizeBoolean(browser.local_storage, "local_storage", unavailableFields),
        session_storage: normalizeBoolean(browser.session_storage, "session_storage", unavailableFields),
        indexed_db: normalizeBoolean(browser.indexed_db, "indexed_db", unavailableFields),
        media_devices: normalizeBoolean(browser.media_devices, "media_devices", unavailableFields),
        fonts_available: normalizeArray(browser.fonts_available, "fonts_available", unavailableFields),
        java_enabled: normalizeBoolean(browser.java_enabled, "java_enabled", unavailableFields),
        webdriver: normalizeBoolean(browser.webdriver, "webdriver", unavailableFields),
        product: normalizeText(browser.product, "product", unavailableFields),
        product_sub: normalizeText(browser.product_sub, "product_sub", unavailableFields),
        app_name: normalizeText(browser.app_name, "app_name", unavailableFields),
        app_version: normalizeText(browser.app_version, "app_version", unavailableFields),
        app_code_name: normalizeText(browser.app_code_name, "app_code_name", unavailableFields),
        online: normalizeBoolean(browser.online, "online", unavailableFields),
        canvas_support: normalizeBoolean(browser.canvas_support, "canvas_support", unavailableFields),
        webgl_support: normalizeBoolean(browser.webgl_support, "webgl_support", unavailableFields),
        webgl2_support: normalizeBoolean(browser.webgl2_support, "webgl2_support", unavailableFields),
    };

    return { normalized, unavailableFields };
}

function fallbackWebglInfo() {
    return {
        version: UNAVAILABLE,
        vendor: UNAVAILABLE,
        renderer: UNAVAILABLE,
        extensions: [],
        max_texture_size: 0,
        max_viewport_width: 0,
        max_viewport_height: 0,
        vertex_precision: 0,
        fragment_precision: 0,
        shading_language_version: UNAVAILABLE,
        render_hash: "",
    };
}

function getErrorCode(component, error) {
    const message = String(error?.message || error || "").toLowerCase();
    if (component === "canvas") {
        return message.includes("context") ? "CANVAS_CONTEXT_UNAVAILABLE" : "CANVAS_SERIALIZATION_FAILED";
    }
    if (component === "webgl") {
        return message.includes("suport") || message.includes("context")
            ? "WEBGL_CONTEXT_UNAVAILABLE"
            : "WEBGL_RENDER_FAILED";
    }
    if (component === "audio") {
        return message.includes("context") || message.includes("api")
            ? "AUDIO_CONTEXT_UNAVAILABLE"
            : "AUDIO_RENDER_FAILED";
    }
    return "UNEXPECTED_COLLECTION_ERROR";
}

const statusEntry = (status, errorCode = null, unavailableFields = undefined) => ({
    status,
    error_code: errorCode,
    ...(unavailableFields ? { unavailable_fields: unavailableFields } : {}),
});

function buildWebglComposite(info) {
    return [
        info.version,
        info.vendor,
        info.renderer,
        info.extensions.join(","),
        info.max_texture_size,
        `${info.max_viewport_width}x${info.max_viewport_height}`,
        info.vertex_precision,
        info.fragment_precision,
        info.shading_language_version,
        info.render_hash,
    ].join("|");
}

export async function collectFingerprints() {
    const [canvasResult, webglResult, browserResult, audioResult] = await Promise.allSettled([
        Promise.resolve().then(() => getCanvaFingerprint()),
        Promise.resolve().then(() => getWebGlFingerprint()),
        Promise.resolve().then(() => getBrowserFingerprint()),
        Promise.resolve().then(() => getAudioFingerprint()),
    ]);

    const canvasAvailable = canvasResult.status === "fulfilled" &&
        typeof canvasResult.value === "string" && canvasResult.value.startsWith("data:image/");
    const canvasDataUrl = canvasAvailable ? canvasResult.value : UNAVAILABLE;
    const canvasStatus = canvasAvailable
        ? statusEntry("ok")
        : statusEntry("error", getErrorCode("canvas", canvasResult.reason));

    const rawWebglInfo = webglResult.status === "fulfilled" ? webglResult.value : fallbackWebglInfo();
    const webglInfo = {
        ...fallbackWebglInfo(),
        ...rawWebglInfo,
        version: rawWebglInfo?.version === "Unknown" ? UNAVAILABLE : rawWebglInfo?.version || UNAVAILABLE,
        vendor: rawWebglInfo?.vendor === "Unknown" ? UNAVAILABLE : rawWebglInfo?.vendor || UNAVAILABLE,
        renderer: rawWebglInfo?.renderer === "Unknown" ? UNAVAILABLE : rawWebglInfo?.renderer || UNAVAILABLE,
        extensions: Array.isArray(rawWebglInfo?.extensions) ? rawWebglInfo.extensions : [],
        shading_language_version: rawWebglInfo?.shading_language_version === "Unknown"
            ? UNAVAILABLE
            : rawWebglInfo?.shading_language_version || UNAVAILABLE,
        render_hash: rawWebglInfo?.render_hash || "",
    };
    const webglAvailable = webglResult.status === "fulfilled" && webglInfo.version !== UNAVAILABLE;
    const webglPartial = webglAvailable && !webglInfo.render_hash;
    const webglStatus = webglAvailable
        ? statusEntry(webglPartial ? "partial" : "ok", webglPartial ? "WEBGL_RENDER_FAILED" : null)
        : statusEntry("unsupported", getErrorCode("webgl", webglResult.reason));

    const rawBrowser = browserResult.status === "fulfilled" ? browserResult.value : {};
    const { normalized: browserFingerprint, unavailableFields } = normalizeBrowserFingerprint(rawBrowser);
    const browserAvailable = browserResult.status === "fulfilled";
    const browserStatus = browserAvailable
        ? statusEntry(
            unavailableFields.length ? "partial" : "ok",
            unavailableFields.length ? "BROWSER_FIELDS_UNAVAILABLE" : null,
            unavailableFields
        )
        : statusEntry("error", "BROWSER_COLLECTION_UNAVAILABLE", unavailableFields);

    const rawAudioInfo = audioResult.status === "fulfilled" ? audioResult.value : null;
    const audioSampleCount = Number(rawAudioInfo?.frame?.size);
    const audioAvailable = audioResult.status === "fulfilled" &&
        audioSampleCount === 5000 &&
        Number.isFinite(rawAudioInfo?.fingerprintValue) &&
        typeof rawAudioInfo?.fingerprint === "string" && rawAudioInfo.fingerprint.length > 0;
    const audioInfo = audioAvailable
        ? {
            ...rawAudioInfo,
            sampleRate: Number(rawAudioInfo.sampleRate) > 0 ? rawAudioInfo.sampleRate : 44100,
        }
        : { fingerprint: "0.000000000000", fingerprintValue: 0, sampleRate: 0, frame: { start: 0, size: 0 } };
    let audioErrorCode = null;
    if (!audioAvailable) {
        if (audioResult.status === "rejected") {
            audioErrorCode = getErrorCode("audio", audioResult.reason);
        } else if (audioSampleCount !== 5000) {
            audioErrorCode = "AUDIO_SAMPLE_COUNT_INVALID";
        } else {
            audioErrorCode = "AUDIO_RESULT_INVALID";
        }
    }
    const audioStatus = audioAvailable
        ? statusEntry("ok")
        : statusEntry("error", audioErrorCode);

    const canvasHash = await sha256Hex(canvasDataUrl);
    const webglHash = await sha256Hex(buildWebglComposite(webglInfo));
    const audioValueStr = audioInfo.fingerprint;
    const audioHash = await sha256Hex(audioValueStr);

    // Mantém a ordem usada pelo C++ para produzir hashes comparáveis.
    const bf = browserFingerprint;
    const browserForHash = {
        user_agent: bf.user_agent,
        language: bf.language,
        languages: bf.languages,
        platform: bf.platform,
        vendor: bf.vendor,
        cookie_enabled: bf.cookie_enabled,
        hardware_concurrency: bf.hardware_concurrency,
        max_touch_points: bf.max_touch_points,
        screen_width: bf.screen_width,
        screen_height: bf.screen_height,
        screen_avail_width: bf.screen_avail_width,
        screen_avail_height: bf.screen_avail_height,
        screen_color_depth: bf.screen_color_depth,
        screen_pixel_depth: bf.screen_pixel_depth,
        screen_resolution: bf.screen_resolution,
        pixel_ratio: bf.pixel_ratio,
        inner_width: bf.inner_width,
        inner_height: bf.inner_height,
        outer_width: bf.outer_width,
        outer_height: bf.outer_height,
        timezone: bf.timezone,
        timezone_offset: bf.timezone_offset,
        local_storage: bf.local_storage,
        session_storage: bf.session_storage,
        indexed_db: bf.indexed_db,
        media_devices: bf.media_devices,
        fonts_available: bf.fonts_available,
        java_enabled: bf.java_enabled,
        webdriver: bf.webdriver,
        product: bf.product,
        product_sub: bf.product_sub,
        app_name: bf.app_name,
        app_version: bf.app_version,
        app_code_name: bf.app_code_name,
        online: bf.online,
        canvas_support: bf.canvas_support,
        webgl_support: bf.webgl_support,
        webgl2_support: bf.webgl2_support,
    };
    let browserJson = JSON.stringify(browserForHash);
    // Preserva a representação decimal usada na serialização do C++.
    browserJson = browserJson
        .replace(/"device_memory":(\d+)([},])/g, '"device_memory":$1.0$2')
        .replace(/"pixel_ratio":(\d+)([},])/g, '"pixel_ratio":$1.0$2');
    const browserHash = await sha256Hex(browserJson);

    const composite = [
        `canvas:${canvasHash}`,
        `webgl:${webglHash}`,
        `audio:${audioHash}`,
        `browser:${browserHash}`,
    ].join("|");
    const fingerprintHash = await sha256Hex(composite);

    return {
        fingerprint_hash: fingerprintHash,
        canvas_fingerprint: {
            hash: canvasHash,
            data_url: canvasDataUrl,
            available: canvasAvailable,
        },
        webgl_fingerprint: {
            hash: webglHash,
            ...webglInfo,
            available: webglAvailable,
        },
        audio_fingerprint: {
            hash: audioHash,
            sample_rate: audioInfo.sampleRate,
            fingerprint_value: Number(audioInfo.fingerprintValue.toFixed(5)),
            sample_count: audioInfo.frame?.size || 0,
            available: audioAvailable,
        },
        browser_fingerprint: {
            hash: browserHash,
            ...browserFingerprint,
            unavailable_fields: unavailableFields,
            available: browserAvailable,
        },
        collector: "javascript",
        collector_version: COLLECTOR_VERSION,
        collection_status: {
            canvas: canvasStatus,
            webgl: webglStatus,
            audio: audioStatus,
            browser: browserStatus,
        },
    };
}
