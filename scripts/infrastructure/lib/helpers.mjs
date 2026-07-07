/**
 * RetailX V2 — Shared infrastructure helpers for migration pipeline
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

export function getProjectRoot() {
  return ROOT;
}

/** Load .env.local into process.env (does not override existing vars). */
export function loadEnvLocal() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getMigrationsDir() {
  return join(ROOT, 'supabase', 'migrations');
}

export function getSeedDir() {
  return join(ROOT, 'supabase', 'seed');
}

export function loadEnvironments() {
  const configPath = join(ROOT, 'supabase', 'config', 'environments.json');
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  return raw;
}

export function resolveEnvironment(name) {
  const env = name ?? process.env.RETAILX_ENV ?? 'development';
  const configs = loadEnvironments();
  if (!configs[env]) {
    throw new Error(`Unknown environment: ${env}. Valid: ${Object.keys(configs).join(', ')}`);
  }
  return env;
}

export function getDatabaseUrl(env) {
  const config = loadEnvironments()[env];
  const url = process.env[config.databaseUrlEnv];
  if (url) return url;

  if (config.fallbackUrlEnv && process.env[config.fallbackUrlEnv]) {
    throw new Error(
      `${config.databaseUrlEnv} is not set. ` +
        `Set the direct Postgres connection string (not the Supabase REST URL).`
    );
  }

  throw new Error(
    `Database URL not configured. Set ${config.databaseUrlEnv} for environment "${env}".`
  );
}

export function checksum(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function parseMigrationFilename(filename) {
  const match = /^(\d{14})_(.+)\.sql$/.exec(filename);
  if (!match) return null;
  return { version: match[1], name: match[2] };
}

export function listMigrationFiles() {
  const dir = getMigrationsDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((filename) => {
      const parsed = parseMigrationFilename(filename);
      if (!parsed) {
        throw new Error(`Invalid migration filename: ${filename}. Expected YYYYMMDDHHMMSS_name.sql`);
      }
      const path = join(dir, filename);
      const content = readFileSync(path, 'utf8');
      return {
        version: parsed.version,
        name: parsed.name,
        filename,
        path,
        checksum: checksum(content),
      };
    })
    .sort((a, b) => a.version.localeCompare(b.version));
}

export function listSeedFiles() {
  const dir = getSeedDir();
  return readdirSync(dir)
    .filter((f) => /^\d{2}_.+\.sql$/.test(f))
    .sort()
    .map((f) => join(dir, f));
}

export async function createClient(env) {
  const config = loadEnvironments()[env];
  const connectionString = getDatabaseUrl(env);
  const useSsl =
    config.requireSsl ||
    /supabase\.co/i.test(connectionString) ||
    process.env.DATABASE_SSL === 'true';
  const client = new pg.Client({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  return client;
}

export async function withTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

export function log(level, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export class MigrationError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    this.details = details;
  }
}

export function validateMigrationFiles(files) {
  const versions = new Set();
  for (const file of files) {
    if (versions.has(file.version)) {
      throw new MigrationError(`Duplicate migration version: ${file.version}`, 'DUPLICATE_VERSION', {
        version: file.version,
      });
    }
    versions.add(file.version);

    const content = readFileSync(file.path, 'utf8');
    if (!content.trim()) {
      throw new MigrationError(`Empty migration file: ${file.filename}`, 'EMPTY_MIGRATION');
    }
  }
}

export async function ensureMigrationHistoryTable(client) {
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'migration_history'
    )
  `);

  if (!tableExists.rows[0].exists) {
    log('warn', 'migration_history table not found — run migrations first');
  }
}

export async function getAppliedMigrations(client, env) {
  try {
    const result = await client.query(
      `SELECT version, name, checksum, status, applied_at, rolled_back_at, environment
       FROM public.migration_history
       WHERE environment = $1 AND status = 'applied'
       ORDER BY version ASC`,
      [env]
    );
    return result.rows;
  } catch {
    return [];
  }
}

export function confirmProduction(message) {
  if (process.env.RETAILX_CONFIRM !== 'yes') {
    throw new MigrationError(
      `${message} Set RETAILX_CONFIRM=yes to proceed.`,
      'CONFIRMATION_REQUIRED'
    );
  }
}

export function readSqlFile(path) {
  return readFileSync(path, 'utf8');
}

export function migrationBasename(file) {
  return basename(file.filename, '.sql');
}
