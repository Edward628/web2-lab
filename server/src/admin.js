// The admin API (C-007): login with the one admin password (D-008), an in-memory
// session (D-019), the flag list of an environment, the switch (the kill switch, D-004)
// and rollout on boolean flags. Every real change is one transaction with the
// config_version bump (D-010) and an audit row (D-020). No CORS: the dashboard is
// served from this origin; writes must be application/json, so a cross-site form
// cannot send them.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual, promisify } from 'node:util';
import express from 'express';
import { readSnapshot, transaction } from './db.js';
import { experimentResults } from './experiments.js';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SESSION_MS = 8 * 60 * 60 * 1000;
const COOKIE = 'ff_admin';
const COOKIE_ATTRIBUTES = 'HttpOnly; Secure; SameSite=Strict; Path=/';
const ENVIRONMENTS = new Set(['dev', 'prod']);
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 60 * 1000;
export const MIN_PASSWORD_LENGTH = 12;

// → "scrypt:<salt hex>:<hash hex>", the ADMIN_PASSWORD_HASH format (no $, which
// Docker Compose would interpolate). Used by `npm run hash-password`.
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// → { salt, hash } buffers, or null when the value is not in that format.
export function parseHash(value) {
  const m = /^scrypt:([0-9a-f]{32}):([0-9a-f]{128})$/.exec(value);
  return m ? { salt: Buffer.from(m[1], 'hex'), hash: Buffer.from(m[2], 'hex') } : null;
}

async function verifyPassword(password, { salt, hash }) {
  return timingSafeEqual(await scrypt(password, salt, KEY_LENGTH), hash);
}

// Tokens live only in this process: a restart logs the admin out (D-019).
function createSessions() {
  const expiries = new Map(); // token → expiry time in ms
  return {
    create() {
      const now = Date.now();
      for (const [token, expiry] of expiries) if (expiry <= now) expiries.delete(token);
      const token = randomBytes(32).toString('hex');
      expiries.set(token, now + SESSION_MS);
      return token;
    },
    isValid(token) {
      const expiry = expiries.get(token);
      if (expiry === undefined) return false;
      if (expiry > Date.now()) return true;
      expiries.delete(token);
      return false;
    },
    end(token) {
      expiries.delete(token);
    },
  };
}

// Q-038: at most 10 failed logins a minute in total, the minute counted from its
// first failure; past that, every login gets 429 until the minute ends. Kept in this
// process, like the sessions.
function createLoginLimit() {
  let windowStart = 0;
  let failures = 0;
  const expire = () => {
    if (Date.now() - windowStart >= FAILURE_WINDOW_MS) failures = 0;
  };
  return {
    isBlocked() {
      expire();
      return failures >= MAX_FAILURES;
    },
    fail() {
      expire();
      if (failures === 0) windowStart = Date.now();
      failures += 1;
    },
  };
}

// Runs fn only after every earlier call has finished: one scrypt at a time, so a flood
// of logins cannot fill the libuv threadpool that P1's files and pg's DNS lookups share.
function createQueue() {
  let last = Promise.resolve();
  return (fn) => {
    const run = last.then(fn);
    last = run.catch(() => {});
    return run;
  };
}

function sessionToken(req) {
  for (const part of (req.get('Cookie') ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE) return value.join('=');
  }
  return null;
}

// → 0 for no variants, N for [{value: true, from: 0, to: N}], else null (C-007).
function rolloutOf(type, variants) {
  if (type !== 'boolean') return null;
  if (variants.length === 0) return 0;
  const [v] = variants;
  return variants.length === 1 && v.value === true && v.from === 0 ? v.to : null;
}

function flagView(row) {
  return {
    key: row.key,
    type: row.type,
    enabled: row.enabled,
    default: row.default,
    ruleCount: row.rules.length,
    variants: row.variants,
    rollout: rolloutOf(row.type, row.variants),
  };
}

// → { enabled } or { rollout }, or null when the body is not exactly one of them.
function parseChange(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 1) return null;
  if (keys[0] === 'enabled' && typeof body.enabled === 'boolean') return { enabled: body.enabled };
  const { rollout } = body;
  if (keys[0] === 'rollout' && Number.isInteger(rollout) && rollout >= 0 && rollout <= 100) return { rollout };
  return null;
}

// The open project (lowest id, Q-040) and its environment of that name, or null.
async function openEnvironment(db, name) {
  const r = await db.query(
    `SELECT p.id AS project_id, p.name AS project_name, e.id, e.config_version
       FROM projects p LEFT JOIN environments e ON e.project_id = p.id AND e.name = $1
      ORDER BY p.id LIMIT 1`,
    [name],
  );
  return r.rowCount === 0 || r.rows[0].id === null ? null : r.rows[0];
}

const FLAG_COLUMNS = 'f.id, f.key, f.type, fe.enabled, fe."default", fe.rules, fe.variants';

async function listFlags(pool, envName) {
  return readSnapshot(pool, async (db) => {
    const env = await openEnvironment(db, envName);
    if (env === null) return null;
    const rows = await db.query(
      `SELECT ${FLAG_COLUMNS} FROM flag_environments fe JOIN flags f ON f.id = fe.flag_id
        WHERE fe.environment_id = $1 ORDER BY f.key`,
      [env.id],
    );
    return {
      project: { id: env.project_id, name: env.project_name },
      environment: envName,
      version: env.config_version,
      flags: rows.rows.map(flagView),
    };
  });
}

// → { flag, version }, 'not-found', or 'rollout-not-boolean'. One transaction (D-020):
// the flag row is locked, so concurrent changes to it apply one after the other.
async function updateFlag(pool, envName, key, change) {
  return transaction(pool, async (db) => {
    const env = await openEnvironment(db, envName);
    if (env === null) return 'not-found';
    const r = await db.query(
      `SELECT ${FLAG_COLUMNS} FROM flag_environments fe JOIN flags f ON f.id = fe.flag_id
        WHERE fe.environment_id = $1 AND f.key = $2 FOR UPDATE OF fe`,
      [env.id, key],
    );
    if (r.rowCount === 0) return 'not-found';
    const row = r.rows[0];

    let action, before, after;
    if ('enabled' in change) {
      action = change.enabled ? 'enable' : 'disable';
      before = { enabled: row.enabled };
      after = { enabled: change.enabled };
    } else {
      if (row.type !== 'boolean') return 'rollout-not-boolean';
      action = 'rollout';
      before = { variants: row.variants };
      after = { variants: [{ value: true, from: 0, to: change.rollout }] };
    }
    const updated = { ...row, ...after };

    // Deep equality, not JSON text: JSONB returns object keys in its own order.
    if (isDeepStrictEqual(before, after)) {
      const v = await db.query('SELECT config_version FROM environments WHERE id = $1', [env.id]);
      return { flag: flagView(row), version: v.rows[0].config_version };
    }
    await db.query(
      `UPDATE flag_environments SET enabled = $3, variants = $4 WHERE flag_id = $1 AND environment_id = $2`,
      [row.id, env.id, updated.enabled, JSON.stringify(updated.variants)],
    );
    const v = await db.query(
      'UPDATE environments SET config_version = config_version + 1 WHERE id = $1 RETURNING config_version',
      [env.id],
    );
    const version = v.rows[0].config_version;
    await db.query(
      `INSERT INTO audit_log (environment_id, flag_id, action, before, after, config_version)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [env.id, row.id, action, JSON.stringify(before), JSON.stringify(after), version],
    );
    return { flag: flagView(updated), version };
  });
}

export function adminRoutes(app, { pool, adminPasswordHash }) {
  const credentials = adminPasswordHash ? parseHash(adminPasswordHash) : null;
  if (adminPasswordHash && credentials === null) {
    // The name only: the value never goes to the log (D-008).
    console.error('ADMIN_PASSWORD_HASH is malformed (expected scrypt:<salt>:<hash> from `npm run hash-password`); admin login is disabled');
  }
  const sessions = createSessions();
  const loginLimit = createLoginLimit();
  const oneAtATime = createQueue();

  const requireJson = (req, res, next) => (req.is('application/json') ? next() : res.status(415).end());
  const json = express.json();
  const requireAdmin = (req, res, next) => (sessions.isValid(sessionToken(req)) ? next() : res.status(401).end());
  const environmentName = (req) => (ENVIRONMENTS.has(req.query.env) ? req.query.env : null);

  app.post(
    '/admin/login',
    (req, res, next) => (credentials ? next() : res.status(503).end()),
    requireJson,
    json,
    async (req, res) => {
      const body = req.body;
      if (body === null || typeof body !== 'object' || Array.isArray(body) || typeof body.password !== 'string') {
        return res.status(400).end();
      }
      // The limit is checked when this login's turn comes, so logins that arrived together
      // cannot all slip past it.
      const outcome = await oneAtATime(async () => {
        if (loginLimit.isBlocked()) return 'limited';
        if (await verifyPassword(body.password, credentials)) return 'ok';
        loginLimit.fail();
        return 'wrong';
      });
      if (outcome === 'limited') return res.status(429).end();
      if (outcome === 'wrong') return res.status(401).end();
      res.set('Set-Cookie', `${COOKIE}=${sessions.create()}; ${COOKIE_ATTRIBUTES}; Max-Age=${SESSION_MS / 1000}`);
      res.status(204).end();
    },
  );

  app.post('/admin/logout', requireAdmin, (req, res) => {
    sessions.end(sessionToken(req));
    res.set('Set-Cookie', `${COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`);
    res.status(204).end();
  });

  app.get('/admin/flags', requireAdmin, async (req, res) => {
    const env = environmentName(req);
    if (env === null) return res.status(400).end();
    let result;
    try {
      result = await listFlags(pool, env);
    } catch (err) {
      console.error('GET /admin/flags: database error', err);
      return res.status(500).end();
    }
    if (result === null) return res.status(404).end();
    res.json(result);
  });

  // The experiment results of one environment (D-001, D-021), from one snapshot.
  app.get('/admin/experiments', requireAdmin, async (req, res) => {
    const env = environmentName(req);
    if (env === null) return res.status(400).end();
    let result;
    try {
      result = await readSnapshot(pool, async (db) => {
        const environment = await openEnvironment(db, env);
        if (environment === null) return null;
        return {
          project: { id: environment.project_id, name: environment.project_name },
          environment: env,
          experiments: await experimentResults(db, environment.id),
        };
      });
    } catch (err) {
      console.error('GET /admin/experiments: database error', err);
      return res.status(500).end();
    }
    if (result === null) return res.status(404).end();
    res.json(result);
  });

  app.patch('/admin/flags/:key', requireAdmin, requireJson, json, async (req, res) => {
    const env = environmentName(req);
    const change = parseChange(req.body);
    if (env === null || change === null) return res.status(400).end();
    // A key with a NUL cannot be stored, so it is unknown without a query.
    if (req.params.key.includes('\u0000')) return res.status(404).end();
    let result;
    try {
      result = await updateFlag(pool, env, req.params.key, change);
    } catch (err) {
      console.error('PATCH /admin/flags: database error', err);
      return res.status(500).end();
    }
    if (result === 'not-found') return res.status(404).end();
    if (result === 'rollout-not-boolean') return res.status(400).end();
    res.json(result);
  });

  // Any other /admin path or method (C-007): 401 without a session, 404 with one, no
  // body, so nobody without a session can map the admin API.
  app.use('/admin', requireAdmin, (req, res) => res.status(404).end());

  // express.json() errors: over 100 kB → 413; any other body it refuses → 400.
  app.use('/admin', (err, req, res, next) => {
    if (err.status === 413) return res.status(413).end();
    if (err.status >= 400 && err.status < 500) return res.status(400).end();
    next(err);
  });
}
