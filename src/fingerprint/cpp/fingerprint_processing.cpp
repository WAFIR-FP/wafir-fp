#include "headers/fingerprint_processing.h"

#include <cmath>
#include <iomanip>
#include <locale>
#include <sstream>

AudioFingerprintResult calculate_audio_fingerprint(const float *samples, std::size_t count) {
  double sum = 0.0;
  if (samples != nullptr) {
    for (std::size_t i = 0; i < count; ++i) {
      sum += std::fabs(static_cast<double>(samples[i]));
    }
  }

  // O coletor de referencia normaliza a soma para Float32 antes de formatar.
  const float fingerprint_value = static_cast<float>(sum);
  if (std::isnan(fingerprint_value)) {
    return {"NaN", fingerprint_value};
  }
  if (std::isinf(fingerprint_value)) {
    return {"Infinity", fingerprint_value};
  }

  std::ostringstream text;
  text.imbue(std::locale::classic());
  text << std::fixed << std::setprecision(12) << fingerprint_value;
  return {text.str(), fingerprint_value};
}

const char *fonts_available_json() {
  // Mantem byte a byte o JSON antes produzido por JSON.stringify no binding JS.
  return "[\"Arial\",\"Verdana\",\"Courier New\",\"Georgia\",\"Palatino\","
         "\"Times New Roman\",\"Trebuchet MS\",\"Impact\",\"Comic Sans MS\","
         "\"Tahoma\",\"Courier\",\"Lucida Console\",\"Monaco\",\"Helvetica\"]";
}
