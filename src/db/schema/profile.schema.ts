/**
 * profile.schema.ts
 * 1-to-1 extension of Better Auth's `user` table.
 * Contains business-specific profile fields that Better Auth does not manage.
 *
 * Design decision: we do NOT add these fields to the `user` table because
 * Better Auth might overwrite unknown columns during future migrations.
 * Keeping the extension separate gives us full control.
 */
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';

/**
 * Internal user profile — one row per internal system user.
 * PK is `user_id` (same as Better Auth user.id), making this a true 1-to-1
 * extension with no surrogate key needed.
 *
 * `activo` controls whether the user can log into the business system,
 * independently of Better Auth's own account status.
 */
export const userProfile = pgTable(
  'user_profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    apellido: varchar('apellido', { length: 100 }).notNull(),
    cargo: varchar('cargo', { length: 100 }),
    area: varchar('area', { length: 100 }),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Lookup active internal users by status (admin queries).
    index('user_profile_activo_idx').on(t.activo),
  ],
);

export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
