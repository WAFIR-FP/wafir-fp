# Privacy, ethics, and limitations

## Scope

This tool was created for research on web fingerprinting and comparison between JavaScript and WebAssembly implementations. It should not be used for covert tracking, automated decision-making about people, or individual identification without an appropriate ethical basis and authorization.

## Observed data

Collection may include:

- Canvas representation and rendering characteristics;
- WebGL vendor, renderer, extensions, and capabilities;
- the result of offline audio rendering;
- user agent, language, platform, time zone, and screen dimensions;
- support for storage, cookies, media, and browser APIs;
- composite hashes and identifiers derived from these signals;
- collection timestamps and session identifiers.

Even when stored as hashes, these values may allow correlation across sessions. Hashing does not equate to anonymization.

## Technical and scientific limitations

- A fingerprint represents an observed environment, not a person's identity.
- Browser, system, driver, or hardware updates can alter the signals.
- Different environments can produce similar values, leading to false positives.
- The same device can produce different values, leading to false negatives.
- Browser protections, extensions, virtualization, and privacy settings affect collection.
- Matcher weights and thresholds are heuristic and must be validated for each population studied.
- A session identifier derived from the hash is stable but increases the risk of linking collections.
- Performance comparisons depend on warm-up, system load, browser, and execution order.
- Results obtained from a limited set of browsers or devices should not be generalized without further validation.
- Unavailable components reduce comparison coverage; high similarity with low coverage does not establish equivalence between environments.
- The codes in `collection_status` help diagnose technical failures but do not establish why an API was blocked or modified by the browser.
- A difference in just one attribute changes the final SHA-256 hash; differing hashes
  do not necessarily mean materially different environments.
- Sequential execution may observe different states of dynamic
  properties, such as window dimensions and orientation.
- The C++/Wasm implementation depends on a JavaScript bridge to access Web
  APIs; conversions at this boundary can also introduce differences.
