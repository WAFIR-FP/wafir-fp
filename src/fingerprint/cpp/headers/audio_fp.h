#pragma once

#ifdef __cplusplus
extern "C" {
#endif

int get_audio_samples(float *samples, int max_samples, int *sample_rate);
int get_audio_error_code(char *buf, int buf_len);

#ifdef __cplusplus
}
#endif
