# 2026 open experiment

## Scope

- Collection period: April 24 to May 1, 2026.
- Design: open invitation via email and social media.
- Observation unit: a browsing session that sequentially runs the
  C++/WebAssembly collector, followed by the JavaScript collector.
- Fields compared per session: 52 — 38 for the browser and DOM, 11 for WebGL, 2 for
  audio, and 1 for Canvas.
- Reported exclusion criterion: more than half of the attributes missing.

The study evaluated reproducibility between implementations. It did not evaluate
performance, memory usage, startup latency, longitudinal stability,
or stealth against anti-fingerprinting tools.

## Sample

| Status | Sessions |
| --- | ---: |
| Collections received | 1,054 |
| Excluded due to incomplete information | 4 |
| Valid for comparison | 1,050 |

Characteristics of the 1,054 collections received:

| Dimension | Distribution |
| --- | --- |
| Device | 651 smartphones (61.8%); 396 desktops/laptops (37.6%); 7 tablets (0.7%) |
| Operating system | 503 Android (47.7%); 294 Windows (27.9%); 143 iOS (13.6%); 82 Linux (7.8%); 32 macOS (3.0%) |
| Browser | 624 Chrome (59.2%); 139 Firefox (13.2%); 124 Safari (11.8%); 89 Samsung Internet (8.4%); 63 Edge (6.0%); 15 Opera (1.4%) |

## Observed equivalence

| Comparison level | Matching | Differing |
| --- | ---: | ---: |
| Final hash per session | 802 of 1,050 (76.38%) | 248 of 1,050 (23.62%) |
| Individual attribute | 54,316 of 54,600 (99.48%) | 284 of 54,600 (0.52%) |

The two percentages are not contradictory. The final hash is constructed from the
hashes of the four components; a single difference among the 52 attributes can
change it completely.

## Categories of differences

| Category | Sessions | % of the 248 sessions with differences | % of the 1,050 valid sessions |
| --- | ---: | ---: | ---: |
| Missing `browser.vendor` | 136 | 54.84% | 12.95% |
| `devicePixelRatio` / `pixel_ratio` | 71 | 28.63% | 6.76% |
| Canvas | 26 | 10.48% | 2.48% |
| Window dimensions | 17 | 6.85% | 1.62% |
| Audio | 16 | 6.45% | 1.52% |
| WebGL | 1 | 0.40% | 0.10% |

The categories are not mutually exclusive. Among the 248 sessions with differing
final hashes, 230 differed in one category, 17 in two, and one in three.

- In 136 sessions, a missing `browser.vendor` was represented in
  different ways (`Unknown` in the C++/Wasm collector and a missing value in JavaScript).
- In 71, `devicePixelRatio` represented the same quantity with different
  numbers of decimal places.
- The 26 Canvas differences produced distinct `data_url` values and hashes, but the
  recorded data do not allow rasterization, font, drawing order,
  or serialization to be isolated as the cause.
- The 17 dimension differences may reflect a change in visual state between the
  two sequential runs; the experiment did not record enough events
  to establish causality.
- The 16 audio differences were concentrated in the processed value, but the
  text input with twelve decimal places used by the hash was not persisted.
- The single WebGL occurrence used fallbacks in the C++/Wasm collector and complete
  data in JavaScript; it also differed in Canvas and audio.

## Interpretation and traceability

The results support the feasibility of C++/WebAssembly for reproducing
most attributes, but also show that hash equality should not be
used alone as evidence of semantic equivalence. Missing values,
decimal precision, dynamic browser state, and fallback policies must
be normalized and diagnosed before identifier generation.
