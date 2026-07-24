import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './src/config/index.js';
import routes from './src/routes/index.js';
import { securityHeaders, createRateLimiter } from './src/middleware/security.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

if (config.server.isProduction) {
  app.set('trust proxy', 1);
}

app.use(securityHeaders);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Decodifica cookies sem depender de middleware externo.
app.use((req, res, next) => {
  const raw = req.headers.cookie || '';
  const parsed = {};

  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    try {
      parsed[key] = decodeURIComponent(value);
    } catch {
      parsed[key] = value;
    }
  }

  req.cookies = parsed;
  next();
});

if (config.security.rateLimit.enabled) {
  app.use('/api/', createRateLimiter());
}

app.use('/build', express.static(path.join(__dirname, 'build')));
app.use('/assets', express.static(path.join(__dirname, 'src/assets')));
app.use('/fingerprint', express.static(path.join(__dirname, 'src/fingerprint')));

app.use('/', routes);

const PORT = config.server.port;
const listenArgs = config.server.isProduction ? [PORT] : [PORT, config.server.host];

app.listen(...listenArgs, () => {
  const host = config.server.isProduction ? '0.0.0.0' : config.server.host;
  const url = `http://${host}:${PORT}`;
  console.log(`Server running at ${url}`);
});
