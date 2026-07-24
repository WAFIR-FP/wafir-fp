#include "headers/fingerprint_processing.h"

#include <cassert>
#include <iostream>
#include <limits>
#include <string>

int main() {
  const AudioFingerprintResult empty = calculate_audio_fingerprint(nullptr, 0);
  assert(empty.fingerprint == "0.000000000000");
  assert(empty.fingerprint_value == 0.0F);

  const float simple_samples[] = {1.0F, -2.0F, 0.5F};
  const AudioFingerprintResult simple = calculate_audio_fingerprint(simple_samples, 3);
  assert(simple.fingerprint == "3.500000000000");
  assert(simple.fingerprint_value == 3.5F);

  // Valor esperado calculado pelo algoritmo anterior de javascript:
  // new Float32Array([samples.reduce((s, x) => s + Math.abs(x), 0)])[0].toFixed(12)
  const float representative_samples[] = {0.00000123F, -0.00000456F, 0.125F, -0.0625F, 1.0F / 3.0F};
  const AudioFingerprintResult representative = calculate_audio_fingerprint(representative_samples, 5);
  assert(representative.fingerprint == "0.520839154720");

  const float non_finite_samples[] = {std::numeric_limits<float>::infinity()};
  const AudioFingerprintResult non_finite = calculate_audio_fingerprint(non_finite_samples, 1);
  assert(non_finite.fingerprint == "Infinity");

  const std::string expected_fonts =
      "[\"Arial\",\"Verdana\",\"Courier New\",\"Georgia\",\"Palatino\","
      "\"Times New Roman\",\"Trebuchet MS\",\"Impact\",\"Comic Sans MS\","
      "\"Tahoma\",\"Courier\",\"Lucida Console\",\"Monaco\",\"Helvetica\"]";
  assert(fonts_available_json() == expected_fonts);

  std::cout << "Testes de processamento do fingerprint concluídos com sucesso.\n";
  return 0;
}
