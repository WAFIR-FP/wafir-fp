#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifdef __EMSCRIPTEN__
// A Web Audio API so existe no host JavaScript. Esta ponte limita-se a renderizar
// o sinal e copiar as amostras; o calculo do fingerprint ocorre em C++/Wasm.
EM_JS(int, get_audio_samples, (float *samples, int max_samples, int *sample_rate), {
  globalThis.__fp_audio_error_code = null;
  var options = {
    sampleRate: 44100,
    frameSize: 5000,
    frameStart: 0,
    bufferLength: 5000
  };

  function resetOutput() {
    if (sample_rate) {
      HEAP32[sample_rate >> 2] = 0;
    }
  }

  function getOfflineAudioContext(sampleRate, length) {
    var OfflineCtx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OfflineCtx) return null;
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

  function getSlice(channelData, frameStart, frameSize) {
    var start = Math.min(frameStart, Math.max(0, channelData.length - frameSize));
    var end = Math.min(channelData.length, start + frameSize);
    return channelData.slice(start, end);
  }

  function collect() {
    var offlineContext = getOfflineAudioContext(options.sampleRate, options.bufferLength);
    if (!offlineContext) throw new Error("OfflineAudioContext indisponivel");

    var oscillator = offlineContext.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 10000;

    var compressor = configureCompressor(offlineContext.createDynamicsCompressor());
    oscillator.connect(compressor);
    compressor.connect(offlineContext.destination);
    oscillator.start(0);

    return Promise.resolve(offlineContext.startRendering()).then(function(renderedBuffer) {
      var channelData = renderedBuffer.getChannelData(0);
      var values = getSlice(channelData, options.frameStart, options.frameSize);
      var count = Math.min(values.length, Math.max(0, max_samples));

      if (samples && count > 0) {
        HEAPF32.set(values.subarray(0, count), samples >> 2);
      }
      if (sample_rate) {
        HEAP32[sample_rate >> 2] = renderedBuffer.sampleRate;
      }
      return count;
    });
  }

  resetOutput();
  if (typeof Asyncify === "undefined" || !Asyncify.handleSleep) {
    globalThis.__fp_audio_error_code = "AUDIO_ASYNCIFY_UNAVAILABLE";
    if (globalThis.console && typeof globalThis.console.error === "function") {
      globalThis.console.error("[C++/WASM] Asyncify indisponivel para a coleta de audio");
    }
    return 0;
  }

  return Asyncify.handleSleep(function(wakeUp) {
    collect()
      .then(function(count) {
        wakeUp(count);
      })
      .catch(function(error) {
        var message = String((error && error.message) || error || "").toLowerCase();
        globalThis.__fp_audio_error_code = message.includes("context")
          ? "AUDIO_CONTEXT_UNAVAILABLE"
          : "AUDIO_RENDER_FAILED";
        if (globalThis.console && typeof globalThis.console.error === "function") {
          globalThis.console.error("[C++/WASM] Falha na coleta de audio", error);
        }
        resetOutput();
        wakeUp(0);
      });
  });
});

EM_JS(int, get_audio_error_code, (char *buf, int buf_len), {
  var value = globalThis.__fp_audio_error_code || "";
  var len = lengthBytesUTF8(value) + 1;
  if (buf && buf_len > 0) stringToUTF8(value, buf, buf_len);
  return len;
});
#endif
