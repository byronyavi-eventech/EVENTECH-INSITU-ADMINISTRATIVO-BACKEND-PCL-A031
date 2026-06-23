import { Router } from 'express';
import { db } from '../db/index.js';
import { usuarioRol, rol } from '../db/schema/rbac.schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const userRouter = Router();

/**
 * GET /api/me/roles
 * Returns the list of active role names assigned to the authenticated user.
 */
userRouter.get('/me/roles', requireAuth, async (_req, res, next) => {
  try {
    const session = res.locals.session as { user: { id: string } };
    const userId = session.user.id;

    const rows = await db
      .select({ nombreRol: rol.nombreRol })
      .from(usuarioRol)
      .innerJoin(rol, eq(usuarioRol.rolId, rol.id))
      .where(eq(usuarioRol.userId, userId));

    const roles = rows.map((r) => r.nombreRol);

    res.json({ status: 'success', data: { roles } });
  } catch (err) {
    next(err);
  }
});
