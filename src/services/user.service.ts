import { db } from '../db/index.js';
import { user, rol, usuarioRol } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Returns the email addresses of all users that have the given role assigned.
 *
 * Conditions:
 *  - rol.nombreRol  = roleName
 *  - rol.activo     = true
 *
 * Note: user_profile is intentionally NOT joined here — it is an optional
 * business-profile extension that may not exist for every user yet.
 * Role assignments are the authoritative source for notification targeting.
 *
 * @param roleName  The stable identifier of the role, e.g. 'ENCARGADO_ADMINISTRATIVO'
 */
export async function getEmailsByRole(roleName: string): Promise<string[]> {
  logger.debug({ roleName }, 'user.service: getEmailsByRole');

  const rows = await db
    .select({ email: user.email })
    .from(user)
    .innerJoin(usuarioRol, eq(usuarioRol.userId, user.id))
    .innerJoin(
      rol,
      and(eq(rol.id, usuarioRol.rolId), eq(rol.activo, true), eq(rol.nombreRol, roleName)),
    );

  const emails = rows.map((r) => r.email);
  logger.debug({ roleName, count: emails.length }, 'user.service: getEmailsByRole result');
  return emails;
}

