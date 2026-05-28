import { auth } from '../auth.js';

type BetterAuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

declare global {
  namespace Express {
    interface Locals {
      session: BetterAuthSession;
    }
  }
}
