const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  return String(value).toLowerCase() === "true" || String(value) === "1";
};

const parseInteger = (value, defaultValue) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const getEnv = (key, defaultValue) =>
  process.env[key] !== undefined ? process.env[key] : defaultValue;

const config = {
  server: {
    nodeEnv: getEnv("NODE_ENV", "development"),
    port: parseInteger(process.env.PORT, 3000),
    host: getEnv("HOST", process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost"),
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV !== "production",
    publicBaseUrl: getEnv("PUBLIC_BASE_URL", "")
  },
  api: {
    baseUrl: getEnv("API_BASE_URL", "http://localhost:3000"),
    version: getEnv("API_VERSION", "v1"),
    timeout: parseInteger(process.env.API_TIMEOUT, 30000),
    endpoints: {
      fingerprint: "/api/fingerprint",
      stats: "/api/stats",
      analytics: "/api/analytics",
      compare: "/api/compare-fingerprints",
      health: "/health"
    }
  },
  security: {
    enableCoopCoep: parseBoolean(process.env.ENABLE_COOP_COEP, true),
    cors: {
      origin: getEnv("CORS_ORIGIN", "*"),
      credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    rateLimit: {
      enabled: parseBoolean(process.env.ENABLE_RATE_LIMIT, true),
      windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60000),
      maxRequests: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 100)
    },
    admin: {
      username: getEnv("ADMIN_USERNAME", "admin"),
      password: getEnv("ADMIN_PASSWORD", "admin123"),
      loginWindowMs: parseInteger(process.env.ADMIN_LOGIN_WINDOW_MS, 15 * 60 * 1000),
      loginMaxAttempts: parseInteger(process.env.ADMIN_LOGIN_MAX_ATTEMPTS, 5)
    }
  },
  storage: {
    dataDir: getEnv("DATA_DIR", "./data"),
    logFile: getEnv("LOG_FILE", "fingerprints.json"),
    statsFile: getEnv("STATS_FILE", "stats.json"),
    maxLogSizeMB: parseInteger(process.env.MAX_LOG_SIZE_MB, 100),
    maxFingerprintAgeDays: parseInteger(process.env.MAX_FINGERPRINT_AGE_DAYS, 30)
  },
  logging: {
    level: getEnv("LOG_LEVEL", "info"),
    format: getEnv("LOG_FORMAT", "json"),
    enableConsole: parseBoolean(process.env.ENABLE_CONSOLE_LOG, true),
    levels: ["error", "warn", "info", "debug", "trace"]
  },
  features: {
    canvas: parseBoolean(process.env.ENABLE_CANVAS, true),
    webgl: parseBoolean(process.env.ENABLE_WEBGL, true),
    audio: parseBoolean(process.env.ENABLE_AUDIO, true),
    browserFingerprint: parseBoolean(process.env.ENABLE_BROWSER_FINGERPRINT, true),
    analytics: parseBoolean(process.env.ENABLE_ANALYTICS, true)
  },
  database: {
    type: getEnv("DB_TYPE", "postgres"),
    host: getEnv("DB_HOST", "localhost"),
    port: parseInteger(process.env.DB_PORT, 5432),
    name: getEnv("DB_NAME", "fingerprints"),
    user: getEnv("DB_USER", "admin"),
    password: getEnv("DB_PASSWORD", ""),
    enabled: parseBoolean(process.env.DB_ENABLED, false),
    ssl: process.env.DB_SSL === undefined ? null : parseBoolean(process.env.DB_SSL, false),
    sslRejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true)
  }
};

const validateConfig = () => {
  const errors = [];

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid port: ${config.server.port}`);
  }
  if (!config.logging.levels.includes(config.logging.level)) {
    errors.push(`Invalid log level: ${config.logging.level}`);
  }
  if (config.security.rateLimit.windowMs < 1 || config.security.rateLimit.maxRequests < 1) {
    errors.push("Rate limit values must be positive integers");
  }
  if (config.security.admin.loginWindowMs < 1 || config.security.admin.loginMaxAttempts < 1) {
    errors.push("Admin login rate limit values must be positive integers");
  }
  if (config.server.isProduction) {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      errors.push("ADMIN_USERNAME and ADMIN_PASSWORD are required in production");
    }
    if (config.security.admin.password === "admin123") {
      errors.push("The default admin password cannot be used in production");
    }
  }
  if (config.database.enabled && config.database.type !== "postgres") {
    errors.push(`Unsupported database type: ${config.database.type}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join("; ")}`);
  }
};

if (process.env.NODE_ENV !== "test") {
  validateConfig();
}

export default config;
