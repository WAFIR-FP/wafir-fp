# Main Components

## Controllers

Receive requests from routes, coordinate the required services, and return responses to the client. Each controller focuses on one area of the application: pages, administration, fingerprint collection, and health checks.

## Services

Contain business logic and data operations. They handle fingerprint processing, log storage, statistics queries, and admin session management.

## Middleware

Perform checks before requests reach the controllers. The application uses middleware for admin authentication, security headers, and request rate limiting.

## Routes

Define the application endpoints and connect each route to its corresponding controller. The `routes/index.js` file centralizes route grouping.

## Fingerprint

Contains the modules responsible for collecting browser and device
characteristics. The application has a reference implementation in JavaScript and
another in C++ compiled to WebAssembly with Emscripten.

The C++/Wasm collector is hybrid: `EM_JS` bridges access Canvas, WebGL, Web Audio, and
browser objects; the C++ module coordinates processing, normalization,
hashing, and output. The collectors produce 52 comparable fields (38 for the browser
and DOM, 11 for WebGL, 2 for audio, and 1 for Canvas), along with hashes and diagnostics.

The shared format, fallbacks, and hash construction are described in [`docs/collection-format.md`](../docs/collection-format.md).

## Views

Stores the HTML templates rendered on the server. The `view.engine.js` file implements a simple variable substitution mechanism for the templates.

## Assets

Contains the application's images, favicon, and manifest.

## Research documentation

Architecture and privacy considerations are documented separately from the code in [`docs/`](../docs/README.md).
