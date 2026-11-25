// Seeds the ParkingLot project (src/seed.js) into DATABASE_URL and prints its SDK
// keys; SDK keys are public (C-002), so printing them is fine. Safe to run again.
// In the stack: docker compose exec server npm run seed
import { createPool, migrate } from '../src/db.js';
import { seedParkingLot } from '../src/seed.js';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = createPool(DATABASE_URL);
try {
  await migrate(pool);
  const keys = await seedParkingLot(pool);
  console.log(`ParkingLot SDK keys:\n  dev:  ${keys.dev}\n  prod: ${keys.prod}`);
} finally {
  await pool.end();
}
