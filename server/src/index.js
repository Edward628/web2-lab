// Starts the server: DATABASE_URL, PORT, P1_SDK_KEY (optional, D-015) and
// ADMIN_PASSWORD_HASH (optional, D-019) come from the environment (docker-compose.yml
// locally, Render env vars when hosted, D-014).
import { createPool, migrate } from './db.js';
import { createApp } from './app.js';

const { DATABASE_URL, PORT = '3000', P1_SDK_KEY, ADMIN_PASSWORD_HASH } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// Without it the server still serves P1 and the SDK; only the admin login is off (503).
if (!ADMIN_PASSWORD_HASH) console.error('ADMIN_PASSWORD_HASH is not set; admin login is disabled');

const pool = createPool(DATABASE_URL);
await migrate(pool);
createApp({ pool, p1SdkKey: P1_SDK_KEY, adminPasswordHash: ADMIN_PASSWORD_HASH }).listen(Number(PORT), () => console.log(`server listening on port ${PORT}`));
