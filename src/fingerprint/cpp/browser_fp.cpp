#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifdef __EMSCRIPTEN__
// Centraliza o acesso seguro aos objetos DOM usados pelas funções EM_JS.
EM_JS(void, init_dom_utils, (), {
  if (!globalThis.__fp) {
    globalThis.__fp = {
      getNavigator() {
        return (typeof window !== 'undefined' && window.navigator) ? window.navigator : null;
      },
      getDocument() {
        if (typeof document !== 'undefined') return document;
        if (typeof window !== 'undefined' && window.document) return window.document;
        return null;
      },
      getWindow() {
        return (typeof window !== 'undefined') ? window : null;
      }
    };
  }
});

EM_JS(int, get_user_agent, (char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var ua = (nav && nav.userAgent) ? nav.userAgent : "Unknown";
  var len = lengthBytesUTF8(ua) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(ua, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_language, (char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var lg = (nav && nav.language) ? nav.language : "Unknown";
  var len = lengthBytesUTF8(lg) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(lg, buf, buf_len);
  }
  return len;
});

// Arrays atravessam a fronteira JS/C++ serializados como JSON.
EM_JS(int, get_languages, (char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var langs = (nav && nav.languages) ? nav.languages : [];
  var result = [];
  for (var i = 0; i < langs.length; i++) {
    var value = langs[i];
    if (typeof value === 'string') result.push(value);
  }
  var json = JSON.stringify(result);
  var len = lengthBytesUTF8(json) + 1;
  if (buf && buf_len > 0) stringToUTF8(json, buf, buf_len);
  return len;
});

EM_JS(int, get_platform, (char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var platform = (nav && nav.platform) ? nav.platform : "Unknown";
  var len = lengthBytesUTF8(platform) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(platform, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_vendor, (char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var vendor = (nav && nav.vendor) ? nav.vendor : "Unknown";
  var len = lengthBytesUTF8(vendor) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(vendor, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_cookie_enabled, (), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  if (nav && typeof nav.cookieEnabled ===  'boolean'){
    return nav.cookieEnabled ? 1 : 0;
  }
  var doc = globalThis.__fp ? globalThis.__fp.getDocument() : null;
  if (!doc) return -1;
  try {
    doc.cookie = 'cookietest=1';
    var enabled = doc.cookie.indexOf('cookietest=') !== -1;
    doc.cookie = 'cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT';
    return enabled ? 1 : 0;
  } catch (_error) {
    return -1;
  }
});

EM_JS(int, get_browser_environment_available, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  return (win && nav && win.screen) ? 1 : 0;
});

EM_JS(int, get_hardware_concurrency, (), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  if (nav && typeof nav.hardwareConcurrency === 'number') {
    return nav.hardwareConcurrency;
  }
  return -1;
});

EM_JS(int, get_max_touch_points, (), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  if (nav && typeof nav.maxTouchPoints === 'number') {
    return nav.maxTouchPoints;
  }
  return -1;
});

extern "C" double get_pixel_ratio(){
  return emscripten_get_device_pixel_ratio();
}

extern "C" void get_screen_size(int *width, int *height){
  emscripten_get_screen_size(width, height);
}

EM_JS(int, get_screen_avail_width, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && win.screen && typeof win.screen.availWidth ===  'number') {
    return win.screen.availWidth;
  }
  return -1;
});

EM_JS(int, get_screen_avail_height, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && win.screen && typeof win.screen.availHeight ===  'number') {
    return win.screen.availHeight;
  }
  return -1;
});

EM_JS(int, get_screen_color_depth, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && win.screen && typeof win.screen.colorDepth ===  'number') {
    return win.screen.colorDepth;
  }
  return -1;
});

EM_JS(int, get_screen_pixel_depth, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && win.screen && typeof win.screen.pixelDepth ===  'number') {
    return win.screen.pixelDepth;
  }
  return -1;
});

EM_JS(int, get_inner_width, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && typeof win.innerWidth ===  'number') {
    return win.innerWidth;
  }
  return -1;
});

EM_JS(int, get_inner_height, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && typeof win.innerHeight ===  'number') {
    return win.innerHeight;
  }
  return -1;
});

EM_JS(int, get_outer_width, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && typeof win.outerWidth ===  'number') {
    return win.outerWidth;
  }
  return -1;
});

EM_JS(int, get_outer_height, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  if (win && typeof win.outerHeight ===  'number') {
    return win.outerHeight;
  }
  return -1;
});

EM_JS(int, get_timezone, (char *buf, int buf_len), {
  var tz = "Unknown";
  try {
    var options = Intl.DateTimeFormat().resolvedOptions();
    tz = options.timeZone || "Unknown";
  } catch (e) {}
  var len = lengthBytesUTF8(tz) + 1;
  if (buf && buf_len > 0) stringToUTF8(tz, buf, buf_len);
  return len;
});

EM_JS(int, get_timezone_offset, (), {
  var time = new Date().getTimezoneOffset();
  return time;
});

EM_JS(int, get_check_local_storage, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  try {
    return (win && 'localStorage' in win && win.localStorage !== null) ? 1 : 0;
  } catch (err) {
    return -1;
  }
});

EM_JS(int, get_check_session_storage, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  try {
    return (win && 'sessionStorage' in win && win.sessionStorage !== null) ? 1 : 0;
  } catch (err) {
    return -1;
  }
});

EM_JS(int, get_check_indexeddb, (), {
  var win = globalThis.__fp ? globalThis.__fp.getWindow() : null;
  try {
    return (win && ('indexedDB' in win)) ? 1 : 0;
  } catch (err) {
    return -1;
  }
});

EM_JS(int, get_check_media_devices, (), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  if (!nav) return -1;
  return (nav.mediaDevices && typeof nav.mediaDevices === 'object') ? 1 : 0;
});

EM_JS(int, get_app_name,(char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var appname = (nav && nav.appName) ? nav.appName : "Unknown";
  var len = lengthBytesUTF8(appname) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(appname, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_app_version,(char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var appversion = (nav && nav.appVersion) ? nav.appVersion : "Unknown";
  var len = lengthBytesUTF8(appversion) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(appversion, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_app_code_name,(char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var codename = (nav && nav.appCodeName) ? nav.appCodeName : "Unknown";
  var len = lengthBytesUTF8(codename) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(codename, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_online,(), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  if (nav && typeof nav.onLine === 'boolean') {
    return nav.onLine ? 1 : 0;
  }
  return -1;
});

EM_JS(int, get_webdriver,(), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  if (nav && typeof nav.webdriver === 'boolean'){
    return nav.webdriver ? 1 : 0;
  }
  return -1;
});

EM_JS(int, get_product,(char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var pd = (nav && nav.product) ? nav.product : "Unknown";
  var len = lengthBytesUTF8(pd) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(pd, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_product_sub,(char *buf, int buf_len), {
  var nav = globalThis.__fp ? globalThis.__fp.getNavigator() : null;
  var pds = (nav && nav.productSub) ? nav.productSub : "Unknown";
  var len = lengthBytesUTF8(pds) + 1;
  if (buf && buf_len > 0) {
    stringToUTF8(pds, buf, buf_len);
  }
  return len;
});

EM_JS(int, get_canva_support, (), {
  var doc = globalThis.__fp ? globalThis.__fp.getDocument() : null;
  if (!doc) return -1;
  try {
    return doc.createElement('canvas') ? 1 : 0;
  } catch (err) {
    return -1;
  }
});

EM_JS(int, get_webgl_support, (), {
  var doc = globalThis.__fp ? globalThis.__fp.getDocument() : null;
  if (!doc) return -1;
  try {
    var canvas = doc.createElement('canvas');
    return canvas.getContext('webgl') ? 1 : 0;
  } catch (err) {
    return -1;
  }
});

EM_JS(int, get_webgl2_support, (), {
  var doc = globalThis.__fp ? globalThis.__fp.getDocument() : null;
  if (!doc) return -1;
  try {
    var canvas = doc.createElement('canvas');
    return canvas.getContext('webgl2') ? 1 : 0;
  } catch (err) {
    return -1;
  }
});
#endif
