#pragma once

#ifdef __cplusplus
extern "C" {
#endif

void init_dom_utils();
int get_browser_environment_available();

int get_user_agent(char *buf, int buf_len);
int get_language(char *buf, int buf_len);
int get_languages(char *buf, int buf_len);
int get_platform(char *buf, int buf_len);
int get_vendor(char *buf, int buf_len);
int get_cookie_enabled();
int get_hardware_concurrency();
int get_max_touch_points();
double get_pixel_ratio();
void get_screen_size(int *width, int *height);
int get_screen_avail_width();
int get_screen_avail_height();
int get_screen_color_depth();
int get_screen_pixel_depth();
int get_inner_width();
int get_inner_height();
int get_outer_width();
int get_outer_height();
int get_timezone(char *buf, int buf_len);
int get_timezone_offset();
int get_check_local_storage();
int get_check_session_storage();
int get_check_indexeddb();
int get_check_media_devices();
int get_app_name(char *buf, int buf_len);
int get_app_version(char *buf, int buf_len);
int get_app_code_name(char *buf, int buf_len);
int get_online();
int get_webdriver();
int get_product(char *buf, int buf_len);
int get_product_sub(char *buf, int buf_len);
int get_canva_support();
int get_webgl_support();
int get_webgl2_support();

#ifdef __cplusplus
}
#endif
