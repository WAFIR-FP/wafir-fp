import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import { sanitizeCppFingerprint } from './fingerprint-validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const useDatabase = config.database.enabled || !!process.env.DATABASE_URL;
const CONFIGURED_DATA_DIR = config.storage?.dataDir || './data';
const LOG_DIR = path.isAbsolute(CONFIGURED_DATA_DIR)
    ? CONFIGURED_DATA_DIR
    : path.resolve(PROJECT_ROOT, CONFIGURED_DATA_DIR);
const LOG_FILE_NAME = config.storage?.logFile || 'fingerprints.json';
const LOG_FILE = path.join(LOG_DIR, LOG_FILE_NAME);
const LEGACY_LOG_FILE = path.join(LOG_DIR, 'fingerprints.log');

let pool;
let poolInitPromise;
let pgSupportChecked = false;
let pgSupported = false;
let fileLogsCache = null;
let fileCachePromise = null;
let fileMutationQueue = Promise.resolve();

const getCppFingerprint = (logEntry = {}) => {
    return logEntry.cpp_fingerprint || logEntry.data || null;
};

const getFingerprintHash = (logEntry = {}) => {
    return getCppFingerprint(logEntry)?.fingerprint_hash || null;
};

const normalizeLogEntry = (logEntry = {}) => {
    const rawCppFingerprint = getCppFingerprint(logEntry);
    const nestedJsFingerprint = rawCppFingerprint?.js_fingerprint || null;
    const cppFingerprint = rawCppFingerprint ? sanitizeCppFingerprint(rawCppFingerprint) : null;

    return {
        id: logEntry.id,
        sessionId: logEntry.sessionId,
        serverTimestamp: logEntry.serverTimestamp,
        cpp_fingerprint: cppFingerprint,
        js_fingerprint: logEntry.js_fingerprint || logEntry.metadata?.js_fingerprint || nestedJsFingerprint,
        clientTimestamp: logEntry.clientTimestamp
    };
};

const formatLogEntry = (logEntry) => {
    return JSON.stringify(logEntry, null, 2)
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
};

const ensureLogDirectoryExists = async () => {
    if (!fsSync.existsSync(LOG_DIR)) {
        await fs.mkdir(LOG_DIR, { recursive: true });
    }
};

const loadLogsFromDisk = async () => {
    await ensureLogDirectoryExists();

    if (!fsSync.existsSync(LOG_FILE)) {
        // Migra o arquivo NDJSON usado por versões anteriores.
        if (!fsSync.existsSync(LEGACY_LOG_FILE)) {
            return [];
        }

        const legacyContent = await fs.readFile(LEGACY_LOG_FILE, 'utf-8');
        const migratedLogs = legacyContent
            .trim()
            .split('\n')
            .filter(line => line)
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(entry => entry)
            .map(normalizeLogEntry);

        await fs.writeFile(LOG_FILE, JSON.stringify(migratedLogs, null, 2));
        return migratedLogs;
    }

    const content = await fs.readFile(LOG_FILE, 'utf-8');
    if (!content.trim()) return [];

    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            return parsed.map(normalizeLogEntry);
        }
    } catch (_) {
        // Aceita NDJSON salvo por engano com extensão .json.
    }

    return content
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        })
        .filter(entry => entry)
        .map(normalizeLogEntry);
};

const ensureFileCacheLoaded = async () => {
    if (fileLogsCache) return fileLogsCache;

    if (!fileCachePromise) {
        fileCachePromise = (async () => {
            const logs = await loadLogsFromDisk();
            fileLogsCache = logs;
            return fileLogsCache;
        })().finally(() => {
            fileCachePromise = null;
        });
    }

    return fileCachePromise;
};

const runFileMutation = (operation) => {
    const result = fileMutationQueue.then(operation, operation);
    fileMutationQueue = result.catch(() => undefined);
    return result;
};

// Insere no fim do array JSON sem reescrever todo o arquivo.
const appendLogEntryToJsonArrayFile = async (logEntry) => {
    const formattedLogEntry = formatLogEntry(logEntry);

    await ensureLogDirectoryExists();

    if (!fsSync.existsSync(LOG_FILE) || fsSync.statSync(LOG_FILE).size === 0) {
        await fs.writeFile(LOG_FILE, `[\n${formattedLogEntry}\n]\n`);
        return;
    }

    const fileHandle = await fs.open(LOG_FILE, 'r+');

    try {
        const { size } = await fileHandle.stat();
        let remaining = size;
        let closingBracketPos = -1;
        let previousChar = '';

        while (remaining > 0 && (closingBracketPos === -1 || !previousChar)) {
            const chunkSize = Math.min(4096, remaining);
            const start = remaining - chunkSize;
            const buffer = Buffer.alloc(chunkSize);
            await fileHandle.read(buffer, 0, chunkSize, start);
            const chunk = buffer.toString('utf8');

            for (let index = chunk.length - 1; index >= 0; index -= 1) {
                const char = chunk[index];
                if (/\s/.test(char)) continue;

                if (closingBracketPos === -1) {
                    if (char !== ']') {
                        throw new Error('Log file is not a JSON array');
                    }
                    closingBracketPos = start + index;
                    continue;
                }

                previousChar = char;
                break;
            }

            remaining = start;
        }

        if (closingBracketPos === -1) {
            throw new Error('Could not find JSON array terminator');
        }

        const separator = previousChar === '[' ? '\n' : ',\n';
        await fileHandle.truncate(closingBracketPos);
        await fileHandle.write(
            `${separator}${formattedLogEntry}\n]\n`,
            closingBracketPos,
            'utf8'
        );
    } finally {
        await fileHandle.close();
    }
};

const canUsePostgres = () => {
    if (pgSupportChecked) return pgSupported;
    pgSupportChecked = true;

    try {
        import.meta.resolve('pg');
        pgSupported = true;
    } catch (_) {
        pgSupported = false;
        if (useDatabase) {
            console.warn('PostgreSQL requested but package "pg" is not installed. Falling back to file logs.');
        }
    }

    return pgSupported;
};

if (!useDatabase && !fsSync.existsSync(LOG_DIR)) {
    fsSync.mkdirSync(LOG_DIR, { recursive: true });
}

const getDbPool = async () => {
    if (!useDatabase || !canUsePostgres()) return null;
    if (pool) return pool;

    if (!poolInitPromise) {
        poolInitPromise = (async () => {
            const connectionString = process.env.DATABASE_URL;
            const sslMode = (() => {
                if (process.env.PGSSLMODE) return process.env.PGSSLMODE.toLowerCase();
                if (!connectionString) return null;
                try {
                    return new URL(connectionString).searchParams.get('sslmode')?.toLowerCase() || null;
                } catch {
                    return null;
                }
            })();
            const sslEnabled = config.database.ssl !== null
                ? config.database.ssl
                : sslMode
                    ? sslMode !== 'disable'
                    : Boolean(connectionString && config.server.isProduction);
            let candidate;
            try {
                const { Pool } = await import('pg');
                candidate = new Pool({
                    connectionString: connectionString || undefined,
                    host: connectionString ? undefined : config.database.host,
                    port: connectionString ? undefined : config.database.port,
                    user: connectionString ? undefined : config.database.user,
                    password: connectionString ? undefined : config.database.password,
                    database: connectionString ? undefined : config.database.name,
                    ssl: sslEnabled
                        ? { rejectUnauthorized: config.database.sslRejectUnauthorized }
                        : false
                });
                await candidate.query(`
                    CREATE TABLE IF NOT EXISTS fingerprint_logs (
                        id TEXT PRIMARY KEY,
                        session_id TEXT,
                        device_category TEXT,
                        client_timestamp TIMESTAMPTZ,
                        server_timestamp TIMESTAMPTZ DEFAULT NOW(),
                        data JSONB,
                        metadata JSONB
                    );
                    ALTER TABLE fingerprint_logs ADD COLUMN IF NOT EXISTS device_category TEXT;
                    CREATE INDEX IF NOT EXISTS idx_fingerprint_logs_server_timestamp ON fingerprint_logs(server_timestamp);
                    CREATE INDEX IF NOT EXISTS idx_fingerprint_logs_fingerprint_hash
                        ON fingerprint_logs ((data->>'fingerprint_hash'));
                `);
                pool = candidate;
                pool.on('error', error => {
                    console.error('PostgreSQL pool error:', error.message);
                });
                return pool;
            } catch (error) {
                console.error('PostgreSQL unavailable; using file fallback:', error.message);
                await candidate?.end().catch(() => undefined);
                return null;
            }
        })().finally(() => {
            poolInitPromise = null;
        });
    }

    return poolInitPromise;
};

const readLogsFromDb = async () => {
    const db = await getDbPool();
    if (!db) return null;

    try {
        // Preserva a mesma ordem cronológica do armazenamento em arquivo.
        const { rows } = await db.query('SELECT * FROM fingerprint_logs ORDER BY server_timestamp ASC');
        return rows.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            serverTimestamp: row.server_timestamp,
            cpp_fingerprint: row.data,
            js_fingerprint: row.metadata?.js_fingerprint || null,
            clientTimestamp: row.client_timestamp
        })).map(normalizeLogEntry);
    } catch (error) {
        console.error('Error reading logs from database:', error);
        return null;
    }
};

const appendLogToDb = async (logEntry) => {
    const db = await getDbPool();
    if (!db) return false;

    try {
        await db.query(
            `INSERT INTO fingerprint_logs (id, session_id, device_category, client_timestamp, server_timestamp, data, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [
                logEntry.id,
                logEntry.sessionId,
                null,
                logEntry.clientTimestamp,
                logEntry.serverTimestamp,
                getCppFingerprint(logEntry),
                { js_fingerprint: logEntry.js_fingerprint || null }
            ]
        );
        return true;
    } catch (error) {
        console.error('Error writing log to database:', error);
        return false;
    }
};

const resetDbLogs = async () => {
    const db = await getDbPool();
    if (!db) return false;

    try {
        await db.query('TRUNCATE TABLE fingerprint_logs');
        return true;
    } catch (error) {
        console.error('Error truncating logs table:', error);
        return false;
    }
};

const readLogsFromFile = async () => {
    try {
        await fileMutationQueue;
        const logs = await ensureFileCacheLoaded();
        return logs.map(log => ({ ...log }));
    } catch (error) {
        console.error('Error reading logs:', error);
        return [];
    }
};

const appendLogToFileUnsafe = async (logEntry) => {
    await ensureFileCacheLoaded();

    const normalizedLogEntry = normalizeLogEntry(logEntry);
    fileLogsCache.push(normalizedLogEntry);

    try {
        await appendLogEntryToJsonArrayFile(normalizedLogEntry);
    } catch (error) {
        // Regrava o arquivo se o append não reconhecer o formato atual.
        await fs.writeFile(LOG_FILE, JSON.stringify(fileLogsCache, null, 2));
        if (error) {
            console.warn('Fell back to full log rewrite after append failure:', error.message);
        }
    }
};

const appendLogToFile = (logEntry) => runFileMutation(() => appendLogToFileUnsafe(logEntry));

const resetFileLogsUnsafe = async () => {
    await ensureLogDirectoryExists();

    if (fsSync.existsSync(LOG_FILE)) {
        await fs.unlink(LOG_FILE);
        console.log('Log file deleted');
    }

    await fs.writeFile(LOG_FILE, '[]\n');
    fileLogsCache = [];
    console.log('New log file created');
};

const resetFileLogs = () => runFileMutation(resetFileLogsUnsafe);

const mergeLogs = (primaryLogs, fallbackLogs) => {
    const byId = new Map();
    for (const log of [...primaryLogs, ...fallbackLogs]) {
        if (log?.id) byId.set(log.id, log);
    }
    return [...byId.values()].sort((left, right) => {
        const leftTime = Date.parse(left.serverTimestamp || left.clientTimestamp) || 0;
        const rightTime = Date.parse(right.serverTimestamp || right.clientTimestamp) || 0;
        return leftTime - rightTime;
    });
};

const readLogs = async () => {
    const dbLogs = await readLogsFromDb();
    if (dbLogs) {
        const fallbackLogs = await readLogsFromFile();
        return mergeLogs(dbLogs, fallbackLogs);
    }
    return readLogsFromFile();
};

const appendLog = async (logEntry) => {
    const savedToDb = await appendLogToDb(logEntry);
    if (savedToDb) return;
    await appendLogToFile(logEntry);
};

const countLogsByFingerprintHash = async (fingerprintHash) => {
    if (!fingerprintHash) return 0;
    const logs = await readLogs();
    return logs.reduce((count, log) => count + Number(getFingerprintHash(log) === fingerprintHash), 0);
};

const resetLogs = async () => {
    const resetDb = await resetDbLogs();
    if (useDatabase && !resetDb) {
        throw new Error('Database is unavailable; no logs were removed');
    }
    await resetFileLogs();
    if (resetDb) console.log('Database logs truncated');
};

const getLogFilePath = () => (useDatabase && canUsePostgres()) ? 'database:fingerprint_logs' : LOG_FILE;

const isDatabaseStorage = () => useDatabase && canUsePostgres();

const getLogsAsJson = async () => {
    const logs = await readLogs();
    if (!logs || logs.length === 0) return '[]';
    return JSON.stringify(logs, null, 2);
};

export {
    readLogs,
    appendLog,
    countLogsByFingerprintHash,
    resetLogs,
    getLogFilePath,
    isDatabaseStorage,
    getLogsAsJson
};
