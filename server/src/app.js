// The Express app. GET /sdk/config (C-002): the configuration of the key's
// environment (C-001), ETag = "<version>" (D-003, D-010), 304 on a matching
// If-None-Match. POST /sdk/events (C-003): the SDK's event batches. CORS for
// browser SDKs on other origins. P1 itself is served here too (D-014, D-015).
import { fileURLToPath } from 'node:url';
import express from 'express';
import { isValidConfig } from '../../sdk/src/validate.js';
import { buildConfig } from './config.js';
import { validateBatch, environmentOf, ingestBatch } from './events.js';

function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Expose-Headers', 'ETag');
  next();
}

const p1Dir = fileURLToPath(new URL('../../p1/', import.meta.url));
const sdkSrcDir = fileURLToPath(new URL('../../sdk/src/', import.meta.url));
// Only these files, never the repo root, .env, tests or package files (D-014).
const staticOptions = { dotfiles: 'ignore', index: false, redirect: false };

// P1 on the server's origin (D-014, D-015): the page, its stylesheet and scripts, the
// SDK sources it imports, and /p1/config.js generated from P1_SDK_KEY (404 without it).
function serveP1(app, p1SdkKey) {
  app.get('/p1', (req, res) => {
    if (!req.path.endsWith('/')) return res.redirect(301, '/p1/');
    res.sendFile('index.html', { root: p1Dir });
  });
  app.get('/p1/styles.css', (req, res) => res.sendFile('styles.css', { root: p1Dir }));
  app.get('/p1/config.js', (req, res) => {
    if (!p1SdkKey) return res.status(404).end();
    res.type('text/javascript').set('Cache-Control', 'no-cache');
    res.send(`export const sdkKey = ${JSON.stringify(p1SdkKey)};\nexport const baseUrl = location.origin;\n`);
  });
  app.use('/p1/src', express.static(`${p1Dir}src`, staticOptions));
  app.use('/sdk/src', express.static(sdkSrcDir, staticOptions));
}

export function createApp({ pool, p1SdkKey }) {
  const app = express();
  app.set('etag', false); // the ETag is the configuration version, set by hand below
  serveP1(app, p1SdkKey);

  app.options('/sdk/config', cors, (req, res) => {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'If-None-Match');
    res.status(204).end();
  });

  app.get('/sdk/config', cors, async (req, res) => {
    const key = req.query.key;
    if (typeof key !== 'string' || key === '') return res.status(400).end();
    let config;
    try {
      config = await buildConfig(pool, key);
    } catch (err) {
      console.error('GET /sdk/config: database error', err);
      return res.status(500).end();
    }
    if (config === null) return res.status(404).end();
    // Never serve a configuration the SDK would reject (C-001).
    if (!isValidConfig(config)) {
      console.error(`GET /sdk/config: configuration version ${config.version} fails C-001; not served`);
      return res.status(500).end();
    }
    const etag = `"${config.version}"`;
    res.set('ETag', etag);
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    res.json(config);
  });

  app.options('/sdk/events', cors, (req, res) => {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
  });

  app.post('/sdk/events', cors, express.json(), async (req, res) => {
    const key = req.query.key;
    if (typeof key !== 'string' || key === '') return res.status(400).end();
    const events = validateBatch(req.body);
    if (events === null) return res.status(400).end();
    try {
      const environmentId = await environmentOf(pool, key);
      if (environmentId === null) return res.status(404).end();
      await ingestBatch(pool, environmentId, events);
    } catch (err) {
      console.error('POST /sdk/events: database error', err);
      return res.status(500).end();
    }
    res.status(204).end();
  });

  // express.json() errors: over 100 kB → 413; any other body it refuses (not JSON,
  // an unsupported charset or Content-Encoding, which it reports as 415) → 400.
  app.use('/sdk/events', (err, req, res, next) => {
    if (err.status === 413) return res.status(413).end();
    if (err.status >= 400 && err.status < 500) return res.status(400).end();
    next(err);
  });

  return app;
}
