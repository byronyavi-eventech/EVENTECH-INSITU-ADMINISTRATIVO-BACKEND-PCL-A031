/**
 * schema.ts — Compatibility re-export
 *
 * This file exists so that existing imports of `./db/schema.js` continue to work
 * without modification (auth.ts, db/index.ts both import from here).
 *
 * The actual schema is modularised under `./db/schema/`.
 * Import from there directly in new code for better tree-shaking.
 */
export * from './schema/index.js';
