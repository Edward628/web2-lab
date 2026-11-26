// Starts the server: DATABASE_URL, PORT and P1_SDK_KEY (optional, D-015) come from the
// environment (docker-compose.yml locally, Render env vars when hosted, D-014).
import { createPool, migrate } from './db.js';
import { createApp } from './app.js';

const { DATABASE_URL, PORT = '3000', P1_SDK_KEY } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = createPool(DATABASE_URL);
await migrate(pool);
createApp({ pool, p1SdkKey: P1_SDK_KEY }).listen(Number(PORT), () => console.log(`server listening on port ${PORT}`));
