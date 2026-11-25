// Starts the server: DATABASE_URL and PORT come from the environment (docker-compose.yml).
import { createPool, migrate } from './db.js';
import { createApp } from './app.js';

const { DATABASE_URL, PORT = '3000' } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = createPool(DATABASE_URL);
await migrate(pool);
createApp({ pool }).listen(Number(PORT), () => console.log(`server listening on port ${PORT}`));
