// The Express app. GET /sdk/config (C-002): the configuration of the key's
// environment (C-001), ETag = "<version>" (D-003, D-010), 304 on a matching
// If-None-Match. POST /sdk/events (C-003): the SDK's event batches. CORS for
// browser SDKs on other origins.
import express from 'express';
import { isValidConfig } from '../../sdk/src/validate.js';
import { buildConfig } from './config.js';
import { validateBatch, environmentOf, ingestBatch } from './events.js';

function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Expose-Headers', 'ETag');
  next();
}

export function createApp({ pool }) {
  const app = express();
  app.set('etag', false); // the ETag is the configuration version, set by hand below

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

  // express.json() errors: a body that is not JSON (400) or over 100 kB (413).
  app.use('/sdk/events', (err, req, res, next) => {
    if (err.status === 400 || err.status === 413) return res.status(err.status).end();
    next(err);
  });

  return app;
}
