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

/**
 * Baseline authorization gate. Must run after `requireAuth`. Rejects with
 * 403 if the authenticated user has zero rows in `usuario_rol` — i.e. no
 * role assigned at all. Does not check for a *specific* role (that's
 * `requireRole`); this only enforces "at least one role exists". Used to
 * close the gap where a brand-new Google account with no role assigned
 * could still reach endpoints that don't have a specific `requireRole`.
 *
 * Deliberately excluded from `/api/me/roles` — a zero-role user still needs
 * to be able to ask "what are my roles?" so the frontend can tell zero-role
 * apart from a loading/error state.
 */
export const requireAnyRole = async (
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

    if (rows.length === 0) {
      res.status(403).json({
        status: 'error',
        message: 'No autorizado. No tienes ningún rol asignado en el sistema.',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};
