import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { usuarioRol, rol } from '../db/schema/rbac.schema.js';

/**
 * Role-based authorization. Must run after `requireAuth` (relies on
 * `res.locals.session`). Fetches the authenticated user's active role
 * names — same query as GET /api/me/roles — and rejects with 403 if none
 * of the required roles are present.
 */
export const requireRole = (...roles: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = res.locals.session as { user: { id: string } };
      const userId = session.user.id;

      const rows = await db
        .select({ nombreRol: rol.nombreRol })
        .from(usuarioRol)
        .innerJoin(rol, eq(usuarioRol.rolId, rol.id))
        .where(eq(usuarioRol.userId, userId));

      const userRoles = rows.map((r) => r.nombreRol);
      const hasRole = roles.some((r) => userRoles.includes(r));

      if (!hasRole) {
        res.status(403).json({
          status: 'error',
          message: 'No autorizado. No tienes el rol requerido para esta acción.',
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
