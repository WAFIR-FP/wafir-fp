#pragma once

#include <cstddef>
#include <string>

struct AudioFingerprintResult {
  std::string fingerprint;
  float fingerprint_value;
};

AudioFingerprintResult calculate_audio_fingerprint(const float *samples, std::size_t count);
const char *fonts_available_json();
