import { app } from './app.js';
import { logger } from './utils/logger.js';
import dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Run db migrations in production
if (process.env.NODE_ENV === 'production') {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  logger.info('Migrations completed successfully.');
} else {
  logger.info('Skipping auto-migrations in non-production environment.');
}

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
