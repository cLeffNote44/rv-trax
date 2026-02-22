import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigrations() {
  const client = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(client);

  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './src/migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await client.end();
}

runMigrations();
