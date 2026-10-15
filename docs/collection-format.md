# Collection format, fallbacks, and comparison

## General structure

The JavaScript and C++/WebAssembly implementations produce the same logical structure. Some internal fields of each component have been omitted from the example:

```json
{
  "fingerprint_hash": "sha256",
  "canvas_fingerprint": {
    "hash": "sha256",
    "data_url": "data:image/png;base64,...",
    "available": true
  },
  "webgl_fingerprint": {
    "hash": "sha256",
    "available": true
  },
  "audio_fingerprint": {
    "hash": "sha256",
    "sample_rate": 44100,
    "fingerprint_value": 0,
    "sample_count": 5000,
    "available": true
  },
  "browser_fingerprint": {
    "hash": "sha256",
    "unavailable_fields": [],
    "available": true
  },
  "collector": "javascript",
  "collector_version": "1.2",
  "collection_status": {
    "canvas": { "status": "ok", "error_code": null },
    "webgl": { "status": "ok", "error_code": null },
    "audio": { "status": "ok", "error_code": null },
    "browser": {
      "status": "ok",
      "error_code": null,
      "unavailable_fields": []
    }
  }
}
```

`collector` is either `javascript` or `cpp-wasm`. The `collector_version` field tracks the version of the collection and fallback behavior, not the browser version.

## Fields compared in the paper

The experimental schema has 52 fields intended for direct comparison between
the implementations. Hashes, availability indicators, and diagnostic
metadata are additional and are not included in this count.

| Category | Count | Fields |
| --- | ---: | --- |
| Canvas | 1 | `data_url` |
| Audio | 2 | `sample_rate`, `fingerprint_value` |
| WebGL | 11 | `vendor`, `version`, `renderer`, `extensions`, `render_hash`, `max_texture_size`, `vertex_precision`, `fragment_precision`, `max_viewport_width`, `max_viewport_height`, `shading_language_version` |
| Browser and DOM | 38 | `Navigator`, `Screen`, and `Window` properties, plus storage and API support |
| **Total** | **52** | |

The 38 browser and DOM field names, in the logical order shared by the collectors,
are: `online`, `vendor`, `product`, `app_name`, `app_code_name`,
`app_version`, `language`, `languages`, `platform`, `timezone`,
`timezone_offset`, `user_agent`, `webdriver`, `indexed_db`, `local_storage`,
`session_storage`, `cookie_enabled`, `java_enabled`, `media_devices`,
`webgl_support`, `webgl2_support`, `canvas_support`, `fonts_available`,
`inner_width`, `inner_height`, `outer_width`, `outer_height`, `pixel_ratio`,
`product_sub`, `screen_width`, `screen_height`, `screen_avail_width`,
`screen_avail_height`, `screen_resolution`, `screen_color_depth`,
`screen_pixel_depth`, `max_touch_points`, and `hardware_concurrency`.

## Statuses and fallbacks

The possible statuses are:

| Status | Meaning |
| --- | --- |
| `ok` | Component fully collected |
| `partial` | Some attributes were collected and others were discarded |
| `error` | The component could not be collected |
| `unsupported` | The required API is not available in the environment |

Fallbacks are deliberately explicit:

| Type or component | Fallback |
| --- | --- |
| Browser or WebGL text | `Unavailable` |
| Unavailable browser number | `-1` |
| Unavailable array | `[]` |
| Unavailable boolean | `false`, with the field name listed in `unavailable_fields` |
| Unavailable Canvas | `data_url: "Unavailable"` and `available: false` |
| Unavailable WebGL | `Unavailable` text values, `0` numeric values, empty arrays, and `available: false` |
| Unavailable audio | Sample rate and value set to `0`, a standardized numeric fingerprint, and `available: false` |
| Entire browser component unavailable | `available: false` |

A boolean value of `false` does not automatically indicate failure. It is discarded only when its field is also listed in `unavailable_fields` or when the entire component has `available: false`.

The diagnostic codes currently emitted include:

- Canvas: `CANVAS_CONTEXT_UNAVAILABLE` and `CANVAS_SERIALIZATION_FAILED`;
- WebGL: `WEBGL_CONTEXT_UNAVAILABLE`, `WEBGL_RENDER_FAILED`, and `UNEXPECTED_COLLECTION_ERROR`;
- audio: `AUDIO_CONTEXT_UNAVAILABLE`, `AUDIO_RENDER_FAILED`, `AUDIO_ASYNCIFY_UNAVAILABLE`, `AUDIO_SAMPLE_COUNT_INVALID`, and `AUDIO_RESULT_INVALID`;
- browser: `BROWSER_COLLECTION_UNAVAILABLE` and `BROWSER_FIELDS_UNAVAILABLE`.

## Audio

Both collectors request an `OfflineAudioContext` with a sample rate of 44.1 kHz and analyze the 5,000 samples in the rendered buffer. The effective sample rate recorded in the JSON comes from the `AudioBuffer` returned by the browser. If only this metadata fails to cross the Asyncify bridge, the requested rate of 44.1 kHz is retained. The component is available when there are exactly 5,000 samples and the calculated result is finite; a missing sample rate alone does not invalidate an otherwise valid audio fingerprint.

## Hash construction

The project does not apply SHA-256 directly to the complete final JSON. Instead:

1. Canvas uses the serialized image representation.
2. WebGL uses a fixed-order composition of version, vendor, renderer, extensions, maximum texture size, viewport, vertex and fragment shader precision, shading language version, and rendering result.
3. Audio uses the standardized decimal representation of the calculated value.
4. Browser uses an object constructed with fields and an order explicitly defined by both collectors; its hash is exposed in `browser_fingerprint.hash`.
5. The final hash uses the Canvas, WebGL, audio, and browser hashes, in that order.

`available`, `unavailable_fields`, `collector`, `collector_version`, and `collection_status` are not included in the calculation. Thus, the property order in the final JSON does not affect the hash. A collection that uses a fallback may produce a different hash than an older version, but the component is then identified as unavailable and is not used as evidence by the matcher.

### Relationship to the 2026 experiment

The paper's results recorded historical differences caused by
missing `browser.vendor` (`Unknown` in one collector and a missing value in the other),
the textual precision of `devicePixelRatio`, WebGL fallback behavior, Canvas, audio, and
window dimensions. Contract `1.2` standardizes unavailable text values as
`Unavailable` and makes availability and errors explicit. This improves the interpretation
of new collections but does not retroactively recalculate the 1,050 records analyzed
in the paper or, by itself, eliminate differences in numerical precision or
API execution.

## Matcher, coverage, and thresholds

The component weights are:

| Component | Maximum weight |
| --- | ---: |
| Canvas | 0.25 |
| WebGL | 0.20 |
| Audio | 0.10 |
| Browser | 0.45 |

Components with `available: false` and fields listed in `unavailable_fields` are excluded. Similarity is normalized only by the weight that could be compared; `coverage` reports the sum of the weights actually available. A same-machine decision requires minimum coverage of `0.50`.

| Classification | Similarity |
| --- | ---: |
| Exact | 95% or higher |
| High / same machine | 85% or higher |
| Medium / probably the same | 75% or higher |
| Low / possibly the same | 65% or higher |
| Different | Below 65% |

The comparison response includes the excluded components and collection statuses for each fingerprint. The weights and thresholds are heuristic and should be validated for the population and experimental protocol used.
