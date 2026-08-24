# Migraciones archivadas (no forman parte del journal activo)

## `0001_quotation_estado_redesign.sql`

**No se renumeró ni se agregó al journal.** Se archivó en su lugar. Investigación (Fase 1
de la fusión, con `git log`/`git show` de solo lectura sobre el repo original en
`C:\Users\tomas\Desktop\diagnostico-fusion-mantenedores\administrativo-backend\`):

- Nunca estuvo en `meta/_journal.json` — drizzle-kit jamás lo reconoció como aplicado
  a través de su propio runner (`drizzle-kit migrate`).
- Se agregó en el commit `2cb4656` (2026-07-28), escrito a mano (sin los marcadores
  `--> statement-breakpoint` que deja `drizzle-kit generate` en los archivos que sí
  genera automáticamente — comparar contra `0004_icy_pestilence.sql` para ver la
  diferencia de formato).
- Comparado línea a línea contra `0004_icy_pestilence.sql` (commit `f5018dd`,
  2026-07-29, un día después): **hacen exactamente el mismo cambio neto** — mismo
  `DROP TYPE estado_cotizacion` + recreación con los mismos 9 valores
  (`NUEVA, ENVIADA_FIRMA, FIRMADA, ENVIADA_CLIENTE, ACEPTADA_CLIENTE,
  RECHAZADA_CLIENTE, RECHAZADA, VENCIDA, ANULADA`), mismas dos columnas nuevas
  (`token_enviado_at`, `respuesta_cliente_at`).

**Conclusión:** `0001_quotation_estado_redesign.sql` fue un parche manual, corrido a
mano contra una base de datos de desarrollo para no bloquearse mientras se trabajaba
la feature. Al día siguiente se generó la migración "oficial" equivalente
(`0004_icy_pestilence.sql`) vía `drizzle-kit generate`, esa sí correctamente
trackeada en el journal. El archivo `0001_...` quedó en el repo como residuo, sin
que nadie lo borrara.

**Por qué NO se renumeró como pidió el prompt original:** insertarlo en la secuencia
(agregarlo al journal con un número nuevo, ej. `0011`) haría que `drizzle-kit migrate`
intente re-ejecutar contra una base de datos nueva un `DROP TYPE ... CASCADE` +
recreación de un enum que la migración `0004` (ya aplicada antes en la secuencia) dejó
en un estado distinto — en el mejor caso es una operación redundante, en el peor
rompe la migración sobre una base de datos limpia. "Sin romper el orden real de
aplicación" en este caso significa **no reinsertarlo**, no encontrarle un número.

Se conserva el archivo acá (no se borra) solo como registro histórico de que existió
y por qué se descartó — no se ejecuta, no está en `_journal.json`, `drizzle-kit`
lo ignora por completo al vivir fuera de `src/db/migrations/`.
