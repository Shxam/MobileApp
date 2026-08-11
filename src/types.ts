/**
 * DEPRECATED as a definition site.
 *
 * Domain types now live in `packages/types`. This file re-exports them so the
 * many `from '../types'` imports across the customer app keep working. Add new
 * types to `packages/types/index.ts`, never here.
 */
export * from '../packages/types';
