#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include "headers/audio_fp.h"
#include "headers/browser_fp.h"
#include "headers/canva_fp.h"
#include "headers/fingerprint_processing.h"
#include "headers/webgl_fp.h"
#include "headers/sha256.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

namespace {

using JsStringGetter = int (*)(char *, int);

struct BrowserData {
  std::string user_agent;
  std::string language;
  std::string languages_json;
  std::string platform;
  std::string vendor;
  bool cookie_enabled;
  int hardware_concurrency;
  int max_touch_points;
  int screen_width;
  int screen_height;
  int screen_avail_width;
  int screen_avail_height;
  int screen_color_depth;
  int screen_pixel_depth;
  std::string screen_resolution;
  double pixel_ratio;
  int inner_width;
  int inner_height;
  int outer_width;
  int outer_height;
  std::string timezone;
  int timezone_offset;
  bool local_storage;
  bool session_storage;
  bool indexed_db;
  bool media_devices;
  std::string fonts_available_json;
  bool java_enabled;
  bool webdriver;
  std::string product;
  std::string product_sub;
  std::string app_name;
  std::string app_version;
  std::string app_code_name;
  bool online;
  bool canvas_support;
  bool webgl_support;
  bool webgl2_support;
  bool available;
  std::vector<std::string> unavailable_fields;
};

struct WebglData {
  std::string version;
  std::string vendor;
  std::string renderer;
  std::string extensions_json;
  std::string extensions_joined;
  int max_texture_size;
  int max_viewport_width;
  int max_viewport_height;
  int vertex_precision;
  int fragment_precision;
  std::string shading_language_version;
  std::string render_hash;
  bool available;
  std::string status;
  std::string error_code;
};

struct AudioData {
  std::string fingerprint;
  double fingerprint_value;
  int sample_rate;
  int sample_count;
  bool available;
  std::string error_code;
};

std::string read_js_string(JsStringGetter getter) {
  const int len = getter(nullptr, 0);
  if (len <= 0) {
    return "";
  }

  std::vector<char> buf(static_cast<size_t>(len));
  getter(buf.data(), len);
  return std::string(buf.data());
}

const char *json_bool(bool value) {
  return value ? "true" : "false";
}

bool is_unavailable_text(const std::string &value) {
  const std::size_t begin = value.find_first_not_of(" \t\n\r");
  if (begin == std::string::npos) return true;
  const std::size_t end = value.find_last_not_of(" \t\n\r");
  const std::string trimmed = value.substr(begin, end - begin + 1);
  return trimmed == "Unknown" || trimmed == "Unavailable";
}

std::string normalize_text(const std::string &value) {
  return is_unavailable_text(value) ? "Unavailable" : value;
}

// Escapa texto recebido do navegador antes de montar o JSON final.
std::string json_escape(const std::string &value) {
  std::ostringstream out;
  for (unsigned char c : value) {
    switch (c) {
      case '\"':
        out << "\\\"";
        break;
      case '\\':
        out << "\\\\";
        break;
      case '\b':
        out << "\\b";
        break;
      case '\f':
        out << "\\f";
        break;
      case '\n':
        out << "\\n";
        break;
      case '\r':
        out << "\\r";
        break;
      case '\t':
        out << "\\t";
        break;
      default:
        if (c < 0x20) {
          out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c) << std::dec;
        } else {
          out << static_cast<char>(c);
        }
    }
  }
  return out.str();
}

std::string json_string_array(const std::vector<std::string> &values) {
  std::ostringstream out;
  out << "[";
  for (std::size_t index = 0; index < values.size(); ++index) {
    if (index > 0) out << ",";
    out << "\"" << json_escape(values[index]) << "\"";
  }
  out << "]";
  return out.str();
}

// Impede que um valor JS inválido quebre o array do JSON final.
std::string sanitize_json_array(const std::string &raw_value) {
  const size_t begin = raw_value.find_first_not_of(" \t\n\r");
  if (begin == std::string::npos) {
    return "[]";
  }
  const size_t end = raw_value.find_last_not_of(" \t\n\r");
  if (raw_value[begin] != '[' || raw_value[end] != ']') {
    return "[]";
  }
  return raw_value.substr(begin, end - begin + 1);
}

int hex_to_int(char c) {
  if (c >= '0' && c <= '9') {
    return c - '0';
  }
  if (c >= 'a' && c <= 'f') {
    return 10 + (c - 'a');
  }
  if (c >= 'A' && c <= 'F') {
    return 10 + (c - 'A');
  }
  return 0;
}

bool parse_json_string_token(const std::string &json, size_t quote_pos, std::string &out_value, size_t &next_pos) {
  if (quote_pos >= json.size() || json[quote_pos] != '\"') {
    return false;
  }

  std::ostringstream out;
  size_t i = quote_pos + 1;
  while (i < json.size()) {
    const char c = json[i];
    if (c == '\"') {
      out_value = out.str();
      next_pos = i + 1;
      return true;
    }

    if (c == '\\') {
      if (i + 1 >= json.size()) {
        return false;
      }
      const char esc = json[i + 1];
      switch (esc) {
        case '\"':
        case '\\':
        case '/':
          out << esc;
          i += 2;
          continue;
        case 'b':
          out << '\b';
          i += 2;
          continue;
        case 'f':
          out << '\f';
          i += 2;
          continue;
        case 'n':
          out << '\n';
          i += 2;
          continue;
        case 'r':
          out << '\r';
          i += 2;
          continue;
        case 't':
          out << '\t';
          i += 2;
          continue;
        case 'u': {
          if (i + 5 >= json.size()) {
            return false;
          }
          const int codepoint = (hex_to_int(json[i + 2]) << 12) | (hex_to_int(json[i + 3]) << 8) |
                                (hex_to_int(json[i + 4]) << 4) | hex_to_int(json[i + 5]);
          if (codepoint >= 0x20 && codepoint <= 0x7E) {
            out << static_cast<char>(codepoint);
          } else {
            out << '?';
          }
          i += 6;
          continue;
        }
        default:
          return false;
      }
    }

    out << c;
    i += 1;
  }

  return false;
}

std::string json_get_string(const std::string &json, const std::string &key, const std::string &fallback) {
  const std::string pattern = "\"" + key + "\"";
  const size_t key_pos = json.find(pattern);
  if (key_pos == std::string::npos) {
    return fallback;
  }

  size_t colon_pos = json.find(':', key_pos + pattern.size());
  if (colon_pos == std::string::npos) {
    return fallback;
  }
  colon_pos += 1;
  while (colon_pos < json.size() && (json[colon_pos] == ' ' || json[colon_pos] == '\n' || json[colon_pos] == '\r' || json[colon_pos] == '\t')) {
    colon_pos += 1;
  }
  if (colon_pos >= json.size() || json[colon_pos] != '\"') {
    return fallback;
  }

  std::string value;
  size_t end_pos = colon_pos;
  if (!parse_json_string_token(json, colon_pos, value, end_pos)) {
    return fallback;
  }
  return value;
}

double json_get_number(const std::string &json, const std::string &key, double fallback) {
  const std::string pattern = "\"" + key + "\"";
  const size_t key_pos = json.find(pattern);
  if (key_pos == std::string::npos) {
    return fallback;
  }

  size_t colon_pos = json.find(':', key_pos + pattern.size());
  if (colon_pos == std::string::npos) {
    return fallback;
  }
  colon_pos += 1;
  while (colon_pos < json.size() && (json[colon_pos] == ' ' || json[colon_pos] == '\n' || json[colon_pos] == '\r' || json[colon_pos] == '\t')) {
    colon_pos += 1;
  }
  if (colon_pos >= json.size()) {
    return fallback;
  }

  size_t end_pos = colon_pos;
  while (end_pos < json.size()) {
    const char c = json[end_pos];
    if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') {
      end_pos += 1;
      continue;
    }
    break;
  }

  if (end_pos == colon_pos) {
    return fallback;
  }

  const std::string token = json.substr(colon_pos, end_pos - colon_pos);
  char *end_ptr = nullptr;
  const double value = std::strtod(token.c_str(), &end_ptr);
  if (end_ptr == token.c_str()) {
    return fallback;
  }
  return value;
}

std::string json_get_array(const std::string &json, const std::string &key, const std::string &fallback) {
  const std::string pattern = "\"" + key + "\"";
  const size_t key_pos = json.find(pattern);
  if (key_pos == std::string::npos) {
    return fallback;
  }

  size_t colon_pos = json.find(':', key_pos + pattern.size());
  if (colon_pos == std::string::npos) {
    return fallback;
  }
  colon_pos += 1;
  while (colon_pos < json.size() &&
         (json[colon_pos] == ' ' || json[colon_pos] == '\n' || json[colon_pos] == '\r' ||
          json[colon_pos] == '\t')) {
    colon_pos += 1;
  }
  if (colon_pos >= json.size() || json[colon_pos] != '[') {
    return fallback;
  }

  int depth = 0;
  bool in_string = false;
  bool escaped = false;
  for (size_t i = colon_pos; i < json.size(); ++i) {
    const char c = json[i];
    if (in_string) {
      if (escaped) {
        escaped = false;
      } else if (c == '\\') {
        escaped = true;
      } else if (c == '\"') {
        in_string = false;
      }
      continue;
    }

    if (c == '\"') {
      in_string = true;
      continue;
    }
    if (c == '[') {
      depth += 1;
      continue;
    }
    if (c == ']') {
      depth -= 1;
      if (depth == 0) {
        return json.substr(colon_pos, i - colon_pos + 1);
      }
      continue;
    }
  }

  return fallback;
}

double round_to(double value, int decimals) {
  if (!std::isfinite(value)) {
    return 0.0;
  }
  const double factor = std::pow(10.0, decimals);
  return std::round(value * factor) / factor;
}

std::string format_number(double value) {
  if (!std::isfinite(value)) {
    return "0";
  }

  std::ostringstream out;
  out << std::setprecision(15) << std::defaultfloat << value;
  std::string text = out.str();

  const size_t exp_pos = text.find_first_of("eE");
  if (exp_pos == std::string::npos) {
    const size_t dot_pos = text.find('.');
    if (dot_pos != std::string::npos) {
      while (!text.empty() && text.back() == '0') {
        text.pop_back();
      }
      if (!text.empty() && text.back() == '.') {
        text.pop_back();
      }
    }
  }

  if (text.empty() || text == "-0") {
    return "0";
  }
  return text;
}

std::string format_number_integral_with_dot_zero(double value) {
  if (!std::isfinite(value)) {
    return "0.0";
  }

  const double rounded = std::round(value);
  if (std::fabs(value - rounded) < 1e-9) {
    std::string base = format_number(rounded);
    if (base == "-0") {
      base = "0";
    }
    return base + ".0";
  }
  return format_number(value);
}

std::string build_browser_hash_json(const BrowserData &browser) {
  std::ostringstream out;
  out << "{";
  out << "\"user_agent\":\"" << json_escape(browser.user_agent) << "\",";
  out << "\"language\":\"" << json_escape(browser.language) << "\",";
  out << "\"languages\":" << browser.languages_json << ",";
  out << "\"platform\":\"" << json_escape(browser.platform) << "\",";
  out << "\"vendor\":\"" << json_escape(browser.vendor) << "\",";
  out << "\"cookie_enabled\":" << json_bool(browser.cookie_enabled) << ",";
  out << "\"hardware_concurrency\":" << browser.hardware_concurrency << ",";
  out << "\"max_touch_points\":" << browser.max_touch_points << ",";
  out << "\"screen_width\":" << browser.screen_width << ",";
  out << "\"screen_height\":" << browser.screen_height << ",";
  out << "\"screen_avail_width\":" << browser.screen_avail_width << ",";
  out << "\"screen_avail_height\":" << browser.screen_avail_height << ",";
  out << "\"screen_color_depth\":" << browser.screen_color_depth << ",";
  out << "\"screen_pixel_depth\":" << browser.screen_pixel_depth << ",";
  out << "\"screen_resolution\":\"" << json_escape(browser.screen_resolution) << "\",";
  out << "\"pixel_ratio\":" << format_number_integral_with_dot_zero(browser.pixel_ratio) << ",";
  out << "\"inner_width\":" << browser.inner_width << ",";
  out << "\"inner_height\":" << browser.inner_height << ",";
  out << "\"outer_width\":" << browser.outer_width << ",";
  out << "\"outer_height\":" << browser.outer_height << ",";
  out << "\"timezone\":\"" << json_escape(browser.timezone) << "\",";
  out << "\"timezone_offset\":" << browser.timezone_offset << ",";
  out << "\"local_storage\":" << json_bool(browser.local_storage) << ",";
  out << "\"session_storage\":" << json_bool(browser.session_storage) << ",";
  out << "\"indexed_db\":" << json_bool(browser.indexed_db) << ",";
  out << "\"media_devices\":" << json_bool(browser.media_devices) << ",";
  out << "\"fonts_available\":" << browser.fonts_available_json << ",";
  out << "\"java_enabled\":" << json_bool(browser.java_enabled) << ",";
  out << "\"webdriver\":" << json_bool(browser.webdriver) << ",";
  out << "\"product\":\"" << json_escape(browser.product) << "\",";
  out << "\"product_sub\":\"" << json_escape(browser.product_sub) << "\",";
  out << "\"app_name\":\"" << json_escape(browser.app_name) << "\",";
  out << "\"app_version\":\"" << json_escape(browser.app_version) << "\",";
  out << "\"app_code_name\":\"" << json_escape(browser.app_code_name) << "\",";
  out << "\"online\":" << json_bool(browser.online) << ",";
  out << "\"canvas_support\":" << json_bool(browser.canvas_support) << ",";
  out << "\"webgl_support\":" << json_bool(browser.webgl_support) << ",";
  out << "\"webgl2_support\":" << json_bool(browser.webgl2_support);
  out << "}";
  return out.str();
}

std::string build_final_json(const std::string &fingerprint_hash, const std::string &canvas_hash,
                             const std::string &canvas_data_url, bool canvas_available,
                             const std::string &canvas_error_code, const std::string &webgl_hash,
                             const WebglData &webgl, const std::string &audio_hash,
                             const AudioData &audio, const std::string &browser_hash,
                             const BrowserData &browser) {
  std::ostringstream out;
  out << "{";
  out << "\"fingerprint_hash\":\"" << json_escape(fingerprint_hash) << "\",";
  out << "\"canvas_fingerprint\":{";
  out << "\"hash\":\"" << json_escape(canvas_hash) << "\",";
  out << "\"data_url\":\"" << json_escape(canvas_data_url) << "\",";
  out << "\"available\":" << json_bool(canvas_available);
  out << "},";

  out << "\"webgl_fingerprint\":{";
  out << "\"hash\":\"" << json_escape(webgl_hash) << "\",";
  out << "\"version\":\"" << json_escape(webgl.version) << "\",";
  out << "\"vendor\":\"" << json_escape(webgl.vendor) << "\",";
  out << "\"renderer\":\"" << json_escape(webgl.renderer) << "\",";
  out << "\"extensions\":" << webgl.extensions_json << ",";
  out << "\"max_texture_size\":" << webgl.max_texture_size << ",";
  out << "\"max_viewport_width\":" << webgl.max_viewport_width << ",";
  out << "\"max_viewport_height\":" << webgl.max_viewport_height << ",";
  out << "\"vertex_precision\":" << webgl.vertex_precision << ",";
  out << "\"fragment_precision\":" << webgl.fragment_precision << ",";
  out << "\"shading_language_version\":\"" << json_escape(webgl.shading_language_version) << "\",";
  out << "\"render_hash\":\"" << json_escape(webgl.render_hash) << "\",";
  out << "\"available\":" << json_bool(webgl.available);
  out << "},";

  out << "\"audio_fingerprint\":{";
  out << "\"hash\":\"" << json_escape(audio_hash) << "\",";
  out << "\"sample_rate\":" << audio.sample_rate << ",";
  out << "\"fingerprint_value\":" << format_number(round_to(audio.fingerprint_value, 5)) << ",";
  out << "\"sample_count\":" << audio.sample_count << ",";
  out << "\"available\":" << json_bool(audio.available);
  out << "},";

  out << "\"browser_fingerprint\":{";
  out << "\"hash\":\"" << json_escape(browser_hash) << "\",";
  out << "\"user_agent\":\"" << json_escape(browser.user_agent) << "\",";
  out << "\"language\":\"" << json_escape(browser.language) << "\",";
  out << "\"languages\":" << browser.languages_json << ",";
  out << "\"platform\":\"" << json_escape(browser.platform) << "\",";
  out << "\"vendor\":\"" << json_escape(browser.vendor) << "\",";
  out << "\"cookie_enabled\":" << json_bool(browser.cookie_enabled) << ",";
  out << "\"hardware_concurrency\":" << browser.hardware_concurrency << ",";
  out << "\"max_touch_points\":" << browser.max_touch_points << ",";
  out << "\"screen_width\":" << browser.screen_width << ",";
  out << "\"screen_height\":" << browser.screen_height << ",";
  out << "\"screen_avail_width\":" << browser.screen_avail_width << ",";
  out << "\"screen_avail_height\":" << browser.screen_avail_height << ",";
  out << "\"screen_color_depth\":" << browser.screen_color_depth << ",";
  out << "\"screen_pixel_depth\":" << browser.screen_pixel_depth << ",";
  out << "\"screen_resolution\":\"" << json_escape(browser.screen_resolution) << "\",";
  out << "\"pixel_ratio\":" << format_number(browser.pixel_ratio) << ",";
  out << "\"inner_width\":" << browser.inner_width << ",";
  out << "\"inner_height\":" << browser.inner_height << ",";
  out << "\"outer_width\":" << browser.outer_width << ",";
  out << "\"outer_height\":" << browser.outer_height << ",";
  out << "\"timezone\":\"" << json_escape(browser.timezone) << "\",";
  out << "\"timezone_offset\":" << browser.timezone_offset << ",";
  out << "\"local_storage\":" << json_bool(browser.local_storage) << ",";
  out << "\"session_storage\":" << json_bool(browser.session_storage) << ",";
  out << "\"indexed_db\":" << json_bool(browser.indexed_db) << ",";
  out << "\"media_devices\":" << json_bool(browser.media_devices) << ",";
  out << "\"fonts_available\":" << browser.fonts_available_json << ",";
  out << "\"java_enabled\":" << json_bool(browser.java_enabled) << ",";
  out << "\"webdriver\":" << json_bool(browser.webdriver) << ",";
  out << "\"product\":\"" << json_escape(browser.product) << "\",";
  out << "\"product_sub\":\"" << json_escape(browser.product_sub) << "\",";
  out << "\"app_name\":\"" << json_escape(browser.app_name) << "\",";
  out << "\"app_version\":\"" << json_escape(browser.app_version) << "\",";
  out << "\"app_code_name\":\"" << json_escape(browser.app_code_name) << "\",";
  out << "\"online\":" << json_bool(browser.online) << ",";
  out << "\"canvas_support\":" << json_bool(browser.canvas_support) << ",";
  out << "\"webgl_support\":" << json_bool(browser.webgl_support) << ",";
  out << "\"webgl2_support\":" << json_bool(browser.webgl2_support) << ",";
  out << "\"unavailable_fields\":" << json_string_array(browser.unavailable_fields) << ",";
  out << "\"available\":" << json_bool(browser.available);
  out << "}";

  out << ",\"collector\":\"cpp-wasm\"";
  out << ",\"collector_version\":\"1.2\"";
  out << ",\"collection_status\":{";
  out << "\"canvas\":{";
  out << "\"status\":\"" << (canvas_available ? "ok" : "error") << "\",";
  out << "\"error_code\":" << (canvas_error_code.empty() ? "null" : "\"" + json_escape(canvas_error_code) + "\"");
  out << "},";
  out << "\"webgl\":{";
  out << "\"status\":\"" << json_escape(webgl.status) << "\",";
  out << "\"error_code\":" << (webgl.error_code.empty() ? "null" : "\"" + json_escape(webgl.error_code) + "\"");
  out << "},";
  out << "\"audio\":{";
  out << "\"status\":\"" << (audio.available ? "ok" : "error") << "\",";
  out << "\"error_code\":" << (audio.error_code.empty() ? "null" : "\"" + json_escape(audio.error_code) + "\"");
  out << "},";
  out << "\"browser\":{";
  out << "\"status\":\""
      << (!browser.available ? "error" : (browser.unavailable_fields.empty() ? "ok" : "partial")) << "\",";
  out << "\"error_code\":";
  if (!browser.available) {
    out << "\"BROWSER_COLLECTION_UNAVAILABLE\"";
  } else if (!browser.unavailable_fields.empty()) {
    out << "\"BROWSER_FIELDS_UNAVAILABLE\"";
  } else {
    out << "null";
  }
  out << ",";
  out << "\"unavailable_fields\":" << json_string_array(browser.unavailable_fields);
  out << "}";
  out << "}";

  out << "}";
  return out.str();
}

AudioData collect_audio_data() {
  constexpr std::size_t kAudioFrameSize = 5000;
  constexpr int kRequestedSampleRate = 44100;
  // O buffer precisa sobreviver à suspensão do Asyncify. Mantê-lo no heap evita
  // que as 5.000 amostras excedam a pilha de 4 KiB usada pelo Asyncify.
  std::vector<float> samples(kAudioFrameSize, 0.0F);
  // A taxa também precisa ficar no heap: Asyncify desmonta e restaura a pilha
  // enquanto aguarda o OfflineAudioContext.
  std::vector<int> sample_rate_storage(1, 0);
  int sample_count = get_audio_samples(
      samples.data(), static_cast<int>(samples.size()), sample_rate_storage.data());
  sample_count = std::clamp(sample_count, 0, static_cast<int>(samples.size()));

  std::string error_code = read_js_string(get_audio_error_code);
  if (sample_count != static_cast<int>(kAudioFrameSize)) {
    if (error_code.empty()) error_code = "AUDIO_SAMPLE_COUNT_INVALID";
    return {"0.000000000000", 0.0, 0, sample_count, false, error_code};
  }

  const AudioFingerprintResult result =
      calculate_audio_fingerprint(samples.data(), static_cast<std::size_t>(sample_count));
  if (!std::isfinite(result.fingerprint_value)) {
    return {"0.000000000000", 0.0, 0, sample_count, false, "AUDIO_RESULT_INVALID"};
  }
  const int sample_rate = sample_rate_storage[0] > 0
      ? sample_rate_storage[0]
      : kRequestedSampleRate;
  return {result.fingerprint, result.fingerprint_value, sample_rate, sample_count, true, ""};
}

std::string canva_fingerprint_from_js() {
  std::string value = read_js_string(get_canva_fingerprint);
  if (value.empty()) {
    return "Unavailable";
  }
  return value;
}

std::string user_agent_from_js() {
  return read_js_string(get_user_agent);
}

std::string language_from_js() {
  return read_js_string(get_language);
}

std::string languages_from_js() {
  return read_js_string(get_languages);
}

std::string platform_from_js() {
  return read_js_string(get_platform);
}

std::string vendor_from_js() {
  return read_js_string(get_vendor);
}

int cookie_enabled_from_js() {
  return get_cookie_enabled();
}

int hardware_concurrency_from_js() {
  return get_hardware_concurrency();
}

int max_touch_points_from_js() {
  return get_max_touch_points();
}

double pixel_ratio_from_js() {
  return get_pixel_ratio();
}

void screen_size_from_js(int *w, int *h) {
  get_screen_size(w, h);
}

int screen_avail_width_from_js() {
  return get_screen_avail_width();
}

int screen_avail_height_from_js() {
  return get_screen_avail_height();
}

int screen_color_depth_from_js() {
  return get_screen_color_depth();
}

int screen_pixel_depth_from_js() {
  return get_screen_pixel_depth();
}

int inner_width_from_js() {
  return get_inner_width();
}

int inner_height_from_js() {
  return get_inner_height();
}

int outer_width_from_js() {
  return get_outer_width();
}

int outer_height_from_js() {
  return get_outer_height();
}

std::string timezone_from_js() {
  return read_js_string(get_timezone);
}

int timezone_offset_from_js() {
  return get_timezone_offset();
}

int local_storage_from_js() {
  return get_check_local_storage();
}

int session_storage_from_js() {
  return get_check_session_storage();
}

int indexeddb_from_js() {
  return get_check_indexeddb();
}

int media_devices_from_js() {
  return get_check_media_devices();
}

std::string app_name_from_js() {
  return read_js_string(get_app_name);
}

std::string app_version_from_js() {
  return read_js_string(get_app_version);
}

std::string app_code_name_from_js() {
  return read_js_string(get_app_code_name);
}

int online_from_js() {
  return get_online();
}

int webdriver_from_js() {
  return get_webdriver();
}

std::string product_from_js() {
  return read_js_string(get_product);
}

std::string product_sub_from_js() {
  return read_js_string(get_product_sub);
}

int canva_support_from_js() {
  return get_canva_support();
}

int webgl_support_from_js() {
  return get_webgl_support();
}

int webgl2_support_from_js() {
  return get_webgl2_support();
}

std::string webgl_info_json_from_js() {
  return read_js_string(get_webgl_info_json);
}

}  // namespace

int main() {
  init_dom_utils();
  init_webgl_utils();

  BrowserData browser{};
  browser.available = get_browser_environment_available() == 1;
  const auto set_browser_text = [&browser](std::string &target, const std::string &value, const char *field) {
    target = normalize_text(value);
    if (target == "Unavailable") browser.unavailable_fields.emplace_back(field);
  };
  const auto normalize_positive = [&browser](int value, const char *field) {
    if (value > 0) return value;
    browser.unavailable_fields.emplace_back(field);
    return -1;
  };
  const auto normalize_nonnegative = [&browser](int value, const char *field) {
    if (value >= 0) return value;
    browser.unavailable_fields.emplace_back(field);
    return -1;
  };
  const auto set_browser_boolean = [&browser](bool &target, int value, const char *field) {
    target = value == 1;
    if (value < 0) browser.unavailable_fields.emplace_back(field);
  };

  set_browser_text(browser.user_agent, user_agent_from_js(), "user_agent");
  set_browser_text(browser.language, language_from_js(), "language");
  browser.languages_json = sanitize_json_array(languages_from_js());
  set_browser_text(browser.platform, platform_from_js(), "platform");
  set_browser_text(browser.vendor, vendor_from_js(), "vendor");
  set_browser_boolean(browser.cookie_enabled, cookie_enabled_from_js(), "cookie_enabled");
  browser.hardware_concurrency = normalize_positive(hardware_concurrency_from_js(), "hardware_concurrency");
  browser.max_touch_points = normalize_nonnegative(max_touch_points_from_js(), "max_touch_points");
  screen_size_from_js(&browser.screen_width, &browser.screen_height);
  browser.screen_width = normalize_positive(browser.screen_width, "screen_width");
  browser.screen_height = normalize_positive(browser.screen_height, "screen_height");
  browser.screen_avail_width = normalize_positive(screen_avail_width_from_js(), "screen_avail_width");
  browser.screen_avail_height = normalize_positive(screen_avail_height_from_js(), "screen_avail_height");
  browser.screen_color_depth = normalize_positive(screen_color_depth_from_js(), "screen_color_depth");
  browser.screen_pixel_depth = normalize_positive(screen_pixel_depth_from_js(), "screen_pixel_depth");
  if (browser.screen_width > 0 && browser.screen_height > 0) {
    browser.screen_resolution = std::to_string(browser.screen_width) + "x" + std::to_string(browser.screen_height);
  } else {
    browser.screen_resolution = "Unavailable";
    browser.unavailable_fields.emplace_back("screen_resolution");
  }
  browser.pixel_ratio = pixel_ratio_from_js();
  if (!std::isfinite(browser.pixel_ratio) || browser.pixel_ratio <= 0) {
    browser.pixel_ratio = -1.0;
    browser.unavailable_fields.emplace_back("pixel_ratio");
  }
  browser.inner_width = normalize_nonnegative(inner_width_from_js(), "inner_width");
  browser.inner_height = normalize_nonnegative(inner_height_from_js(), "inner_height");
  browser.outer_width = normalize_nonnegative(outer_width_from_js(), "outer_width");
  browser.outer_height = normalize_nonnegative(outer_height_from_js(), "outer_height");
  set_browser_text(browser.timezone, timezone_from_js(), "timezone");
  browser.timezone_offset = timezone_offset_from_js();
  set_browser_boolean(browser.local_storage, local_storage_from_js(), "local_storage");
  set_browser_boolean(browser.session_storage, session_storage_from_js(), "session_storage");
  set_browser_boolean(browser.indexed_db, indexeddb_from_js(), "indexed_db");
  set_browser_boolean(browser.media_devices, media_devices_from_js(), "media_devices");
  browser.fonts_available_json = fonts_available_json();
  browser.java_enabled = false;
  set_browser_boolean(browser.webdriver, webdriver_from_js(), "webdriver");
  set_browser_text(browser.product, product_from_js(), "product");
  set_browser_text(browser.product_sub, product_sub_from_js(), "product_sub");
  set_browser_text(browser.app_name, app_name_from_js(), "app_name");
  set_browser_text(browser.app_version, app_version_from_js(), "app_version");
  set_browser_text(browser.app_code_name, app_code_name_from_js(), "app_code_name");
  set_browser_boolean(browser.online, online_from_js(), "online");
  set_browser_boolean(browser.canvas_support, canva_support_from_js(), "canvas_support");
  set_browser_boolean(browser.webgl_support, webgl_support_from_js(), "webgl_support");
  set_browser_boolean(browser.webgl2_support, webgl2_support_from_js(), "webgl2_support");

  const std::string raw_canvas_data_url = canva_fingerprint_from_js();
  const bool canvas_available = raw_canvas_data_url.rfind("data:image/", 0) == 0;
  const std::string canvas_data_url = canvas_available ? raw_canvas_data_url : "Unavailable";
  std::string canvas_error_code;
  if (!canvas_available) {
    canvas_error_code = raw_canvas_data_url.find("context") != std::string::npos ||
            raw_canvas_data_url.find("document") != std::string::npos
        ? "CANVAS_CONTEXT_UNAVAILABLE"
        : "CANVAS_SERIALIZATION_FAILED";
  }

  const std::string webgl_json = webgl_info_json_from_js();
  WebglData webgl{};
  webgl.version = normalize_text(json_get_string(webgl_json, "version", "Unavailable"));
  webgl.vendor = normalize_text(json_get_string(webgl_json, "vendor", "Unavailable"));
  webgl.renderer = normalize_text(json_get_string(webgl_json, "renderer", "Unavailable"));
  webgl.extensions_json = sanitize_json_array(json_get_array(webgl_json, "extensions", "[]"));
  webgl.extensions_joined = json_get_string(webgl_json, "extensions_joined", "");
  webgl.max_texture_size = static_cast<int>(std::lround(json_get_number(webgl_json, "max_texture_size", 0.0)));
  webgl.max_viewport_width = static_cast<int>(std::lround(json_get_number(webgl_json, "max_viewport_width", 0.0)));
  webgl.max_viewport_height = static_cast<int>(std::lround(json_get_number(webgl_json, "max_viewport_height", 0.0)));
  webgl.vertex_precision = static_cast<int>(std::lround(json_get_number(webgl_json, "vertex_precision", 0.0)));
  webgl.fragment_precision = static_cast<int>(std::lround(json_get_number(webgl_json, "fragment_precision", 0.0)));
  webgl.shading_language_version = normalize_text(json_get_string(webgl_json, "shading_language_version", "Unavailable"));
  webgl.render_hash = json_get_string(webgl_json, "render_hash", "");
  webgl.status = json_get_string(webgl_json, "status", webgl.version == "Unavailable" ? "unsupported" : "ok");
  webgl.error_code = json_get_string(webgl_json, "error_code", "");
  webgl.available = webgl.version != "Unavailable";

  const AudioData audio = collect_audio_data();

  const std::string canvas_hash = sha256_hex(canvas_data_url);
  const std::string webgl_composite =
      webgl.version + "|" + webgl.vendor + "|" + webgl.renderer + "|" + webgl.extensions_joined +
      "|" + std::to_string(webgl.max_texture_size) +
      "|" + std::to_string(webgl.max_viewport_width) + "x" + std::to_string(webgl.max_viewport_height) +
      "|" + std::to_string(webgl.vertex_precision) +
      "|" + std::to_string(webgl.fragment_precision) +
      "|" + webgl.shading_language_version + "|" + webgl.render_hash;
  const std::string webgl_hash = sha256_hex(webgl_composite);
  const std::string audio_hash = sha256_hex(audio.fingerprint);

  const std::string browser_hash_json = build_browser_hash_json(browser);
  const std::string browser_hash = sha256_hex(browser_hash_json);

  const std::string fingerprint_composite = "canvas:" + canvas_hash + "|webgl:" + webgl_hash + "|audio:" + audio_hash + "|browser:" + browser_hash;
  const std::string fingerprint_hash = sha256_hex(fingerprint_composite);

  const std::string final_json = build_final_json(
      fingerprint_hash, canvas_hash, canvas_data_url, canvas_available, canvas_error_code,
      webgl_hash, webgl, audio_hash, audio, browser_hash, browser);

  std::cout << final_json << "\n";
  return 0;
}
