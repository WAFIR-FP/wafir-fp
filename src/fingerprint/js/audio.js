import {
    AUDIO_FINGERPRINT_OPTIONS,
    getOfflineAudioContext,
    configureCompressor,
} from "./audioUtils.js"

const DEFAULT_OPTIONS = AUDIO_FINGERPRINT_OPTIONS;

function getSlice(channelData, frameStart, frameSize) {
    const start = Math.min(frameStart, Math.max(0, channelData.length - frameSize));
    const end = Math.min(channelData.length, start + frameSize);
    return {
        start,
        data: channelData.slice(start, end),
    };
}

function sumAbsolute(values) {
    let sum = 0;
    for (let i = 0; i < values.length; i += 1) {
        sum += Math.abs(values[i]);
    }
    return sum;
}

class AudioFingerprint{
    // Renderiza um sinal fixo para capturar diferenças da pilha de áudio.
    static async collect() {
        if (typeof window === "undefined" && typeof globalThis.OfflineAudioContext === "undefined") {
            throw new Error("Ambiente sem APIs de áudio");
        }

        const { sampleRate, frameSize, frameStart, bufferLength } = DEFAULT_OPTIONS;
        const offlineContext = getOfflineAudioContext({ sampleRate, length: bufferLength });

        if (!offlineContext) {
            throw new Error("OfflineAudioContext indisponível");
        }

        const oscillator = offlineContext.createOscillator();
        oscillator.type = "triangle";
        oscillator.frequency.value = 10000;

        const compressor = configureCompressor(offlineContext.createDynamicsCompressor());

        oscillator.connect(compressor);
        compressor.connect(offlineContext.destination);
        oscillator.start(0);

        const renderedBuffer = await offlineContext.startRendering();
        const channelData = renderedBuffer.getChannelData(0);

        const { start: sliceStart, data: sliceData } = getSlice(channelData, frameStart, frameSize);
        const fingerprintValue = sumAbsolute(sliceData);
        const fingerprintF32 = new Float32Array([fingerprintValue])[0];
        const fingerprint = fingerprintF32.toFixed(12);

        return {
            fingerprint,
            fingerprintValue: fingerprintF32,
            sampleRate: renderedBuffer.sampleRate,
            frame: {
                start: sliceStart,
                size: sliceData.length,
            },
        };
    }
}

export async function getAudioFingerprint() {
    return AudioFingerprint.collect()
}
