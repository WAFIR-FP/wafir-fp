const AUDIO_FINGERPRINT_OPTIONS = Object.freeze({
    sampleRate: 44100,
    frameSize: 5000,
    frameStart: 0,
    bufferLength: 5000,
});

function getOfflineAudioContext({ sampleRate, length }) {
    const OfflineCtx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OfflineCtx) {
        return null;
    }
    try {
        return new OfflineCtx(1, length, sampleRate);
    } catch (_error) {
        return null;
    }
}

function configureCompressor(compressor) {
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    return compressor;
}

export {
    AUDIO_FINGERPRINT_OPTIONS,
    getOfflineAudioContext,
    configureCompressor
}
