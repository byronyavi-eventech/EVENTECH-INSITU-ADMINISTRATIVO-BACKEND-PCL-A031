-- =============================================================================
-- Seed: Catálogo de Ensayos Laboratorio
--
-- Instrucciones:
--   1. Pegar en Drizzle Studio → SQL console y ejecutar.
--   2. Idempotente: usa INSERT ... ON CONFLICT DO NOTHING en área/subárea.
--   3. Los precios están en UF — se guardan como texto numérico (NUMERIC 12,2).
--   4. Ejecutar todo de una vez (es una sola transacción).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Áreas
-- -----------------------------------------------------------------------------
INSERT INTO area_ensayo (nombre_area)
VALUES
  ('CONSTRUCCIÓN - MECANICA DE SUELOS'),
  ('CONSTRUCCIÓN - HORMIGON')
ON CONFLICT (nombre_area) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Subáreas
--    Nota: la línea 19 del md repite "ARIDOS PARA SUELOS" pero contiene
--    ensayos de CONTROL EN TERRENO — se corrige el nombre aquí.
-- -----------------------------------------------------------------------------
INSERT INTO subarea_ensayo (area_id, nombre_subarea)
SELECT a.id, s.nombre_subarea
FROM (VALUES
  ('CONSTRUCCIÓN - MECANICA DE SUELOS', 'OBRAS DE PAVIMENTACIÓN, SEGÚN CONVENIO INN-MINVU'),
  ('CONSTRUCCIÓN - MECANICA DE SUELOS', 'ARIDOS PARA SUELOS, SEGÚN CONVENIO INN-MINVU'),
  ('CONSTRUCCIÓN - MECANICA DE SUELOS', 'CONTROL DE COMPACTACIÓN EN TERRENO, SEGÚN CONVENIO INN-MINVU'),
  ('CONSTRUCCIÓN - HORMIGON',           'OBRAS DE EDIFICACIÓN Y PAVIMENTACIÓN, SEGÚN CONVENIO INN-MINVU'),
  ('CONSTRUCCIÓN - HORMIGON',           'ARIDOS PARA HORMIGÓN, SEGÚN CONVENIO INN-MINVU')
) AS s(nombre_area, nombre_subarea)
JOIN area_ensayo a ON a.nombre_area = s.nombre_area
ON CONFLICT (area_id, nombre_subarea) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Tipos de ensayo + precio activo
--    Insertamos el tipo y su precio en pasos separados para claridad.
-- -----------------------------------------------------------------------------

-- ── MECÁNICA DE SUELOS / PAVIMENTACIÓN ──────────────────────────────────────

WITH sub AS (
  SELECT sa.id
  FROM subarea_ensayo sa
  JOIN area_ensayo a ON a.id = sa.area_id
  WHERE a.nombre_area   = 'CONSTRUCCIÓN - MECANICA DE SUELOS'
    AND sa.nombre_subarea = 'OBRAS DE PAVIMENTACIÓN, SEGÚN CONVENIO INN-MINVU'
),
ins AS (
  INSERT INTO tipo_ensayo (subarea_id, nombre_tipo_ensayo, codigo_norma)
  SELECT sub.id, e.nombre, e.norma
  FROM sub, (VALUES
    ('Análisis granilométrico',              'Método 8.102.1, diciembre 2003, Manual de carreteras Vol.8'),
    ('Humedad',                              'NCh1515.Of79'),
    ('Límite líquido',                       'NCh1517/1.Of79'),
    ('Límite plástico',                      'NCh1517/2.Of79'),
    ('Razón de soporte (CBR)',               'NCh1852.Of81'),
    ('Densidad de partículas sólidas',       'NCh1532.Of80'),
    ('Compactación, método proctor modificado', 'NCh1534/2.Of79')
  ) AS e(nombre, norma)
  ON CONFLICT (subarea_id, nombre_tipo_ensayo) DO NOTHING
  RETURNING id, nombre_tipo_ensayo
)
INSERT INTO precio_ensayo (tipo_ensayo_id, precio, fecha_inicio, fecha_fin, activo)
SELECT ins.id, p.precio, CURRENT_DATE, NULL, TRUE
FROM ins
JOIN (VALUES
  ('Análisis granilométrico',              1.00::numeric),
  ('Humedad',                              0.00::numeric),
  ('Límite líquido',                       1.50::numeric),
  ('Límite plástico',                      1.50::numeric),
  ('Razón de soporte (CBR)',               2.20::numeric),
  ('Densidad de partículas sólidas',       1.50::numeric),
  ('Compactación, método proctor modificado', 2.20::numeric)
) AS p(nombre, precio) ON p.nombre = ins.nombre_tipo_ensayo;

-- ── MECÁNICA DE SUELOS / ÁRIDOS PARA SUELOS ─────────────────────────────────

WITH sub AS (
  SELECT sa.id
  FROM subarea_ensayo sa
  JOIN area_ensayo a ON a.id = sa.area_id
  WHERE a.nombre_area   = 'CONSTRUCCIÓN - MECANICA DE SUELOS'
    AND sa.nombre_subarea = 'ARIDOS PARA SUELOS, SEGÚN CONVENIO INN-MINVU'
),
ins AS (
  INSERT INTO tipo_ensayo (subarea_id, nombre_tipo_ensayo, codigo_norma)
  SELECT sub.id, e.nombre, e.norma
  FROM sub, (VALUES
    ('Cubicidad de partículas',                         'Método 8.202.6, junio 2009, Manual de carreteras Vol.8'),
    ('Desgaste de los pétreos (máquina de los ángeles)', 'NCh1369:2010')
  ) AS e(nombre, norma)
  ON CONFLICT (subarea_id, nombre_tipo_ensayo) DO NOTHING
  RETURNING id, nombre_tipo_ensayo
)
INSERT INTO precio_ensayo (tipo_ensayo_id, precio, fecha_inicio, fecha_fin, activo)
SELECT ins.id, p.precio, CURRENT_DATE, NULL, TRUE
FROM ins
JOIN (VALUES
  ('Cubicidad de partículas',                         2.00::numeric),
  ('Desgaste de los pétreos (máquina de los ángeles)', 2.50::numeric)
) AS p(nombre, precio) ON p.nombre = ins.nombre_tipo_ensayo;

-- ── MECÁNICA DE SUELOS / CONTROL EN TERRENO ─────────────────────────────────

WITH sub AS (
  SELECT sa.id
  FROM subarea_ensayo sa
  JOIN area_ensayo a ON a.id = sa.area_id
  WHERE a.nombre_area   = 'CONSTRUCCIÓN - MECANICA DE SUELOS'
    AND sa.nombre_subarea = 'CONTROL DE COMPACTACIÓN EN TERRENO, SEGÚN CONVENIO INN-MINVU'
),
ins AS (
  INSERT INTO tipo_ensayo (subarea_id, nombre_tipo_ensayo, codigo_norma)
  SELECT sub.id, e.nombre, e.norma
  FROM sub, (VALUES
    ('Densidad en terreno, método nuclear', 'Método 8.502.1, diciembre 2003, Manual de carreteras Vol.8'),
    ('Humedad en terreno, método nuclear',  'Método 8.502.1, diciembre 2003, Manual de carreteras Vol.8'),
    ('Muestreo de suelos',                  'UNE 7371:1975'),
    ('Sales solubles',                      NULL)
  ) AS e(nombre, norma)
  ON CONFLICT (subarea_id, nombre_tipo_ensayo) DO NOTHING
  RETURNING id, nombre_tipo_ensayo
)
INSERT INTO precio_ensayo (tipo_ensayo_id, precio, fecha_inicio, fecha_fin, activo)
SELECT ins.id, p.precio, CURRENT_DATE, NULL, TRUE
FROM ins
JOIN (VALUES
  ('Densidad en terreno, método nuclear', 1.00::numeric),
  ('Humedad en terreno, método nuclear',  0.00::numeric),
  ('Muestreo de suelos',                  0.00::numeric),
  ('Sales solubles',                      1.50::numeric)
) AS p(nombre, precio) ON p.nombre = ins.nombre_tipo_ensayo;

-- ── HORMIGÓN / EDIFICACIÓN Y PAVIMENTACIÓN ───────────────────────────────────

WITH sub AS (
  SELECT sa.id
  FROM subarea_ensayo sa
  JOIN area_ensayo a ON a.id = sa.area_id
  WHERE a.nombre_area   = 'CONSTRUCCIÓN - HORMIGON'
    AND sa.nombre_subarea = 'OBRAS DE EDIFICACIÓN Y PAVIMENTACIÓN, SEGÚN CONVENIO INN-MINVU'
),
ins AS (
  INSERT INTO tipo_ensayo (subarea_id, nombre_tipo_ensayo, codigo_norma)
  SELECT sub.id, e.nombre, e.norma
  FROM sub, (VALUES
    ('Compresión',                                                         'NCh1037-2009'),
    ('Confección y curado en obra de probetas para ensayos de compresión', 'NCh1017:2009'),
    ('Densidad aparente',                                                  'NCh1564.Of2009'),
    ('Docilidad, método de asentamiento del cono de Abrams',               'NCh1019.Of2009'),
    ('Extracción de muestras de hormigón fresco',                          'NCh171:2008'),
    ('Extracción, preparación y ensayo de testigos',                       'NCh1171/1:2012'),
    ('Refrentado de probetas',                                             'NCh1172.Of2010, Cláusula 7, Procedimiento C')
  ) AS e(nombre, norma)
  ON CONFLICT (subarea_id, nombre_tipo_ensayo) DO NOTHING
  RETURNING id, nombre_tipo_ensayo
)
INSERT INTO precio_ensayo (tipo_ensayo_id, precio, fecha_inicio, fecha_fin, activo)
SELECT ins.id, p.precio, CURRENT_DATE, NULL, TRUE
FROM ins
JOIN (VALUES
  ('Compresión',                                                         1.50::numeric),
  ('Confección y curado en obra de probetas para ensayos de compresión', 0.00::numeric),
  ('Densidad aparente',                                                  2.10::numeric),
  ('Docilidad, método de asentamiento del cono de Abrams',               0.50::numeric),
  ('Extracción de muestras de hormigón fresco',                          0.00::numeric),
  ('Extracción, preparación y ensayo de testigos',                       6.70::numeric),
  ('Refrentado de probetas',                                             0.00::numeric)
) AS p(nombre, precio) ON p.nombre = ins.nombre_tipo_ensayo;

-- ── HORMIGÓN / ÁRIDOS PARA HORMIGÓN ─────────────────────────────────────────

WITH sub AS (
  SELECT sa.id
  FROM subarea_ensayo sa
  JOIN area_ensayo a ON a.id = sa.area_id
  WHERE a.nombre_area   = 'CONSTRUCCIÓN - HORMIGON'
    AND sa.nombre_subarea = 'ARIDOS PARA HORMIGÓN, SEGÚN CONVENIO INN-MINVU'
),
ins AS (
  INSERT INTO tipo_ensayo (subarea_id, nombre_tipo_ensayo, codigo_norma)
  SELECT sub.id, e.nombre, e.norma
  FROM sub, (VALUES
    ('Análisis granulométrico',            'NCh165.Of2009'),
    ('Cubicidad de partículas',            'Método 8.202.6, junio 2009, Manual de carreteras Vol.8'),
    ('Equivalente de arena',               'NCh1325:2010'),
    ('Extracción y preparación de muestras', 'NCh164:2009')
  ) AS e(nombre, norma)
  ON CONFLICT (subarea_id, nombre_tipo_ensayo) DO NOTHING
  RETURNING id, nombre_tipo_ensayo
)
INSERT INTO precio_ensayo (tipo_ensayo_id, precio, fecha_inicio, fecha_fin, activo)
SELECT ins.id, p.precio, CURRENT_DATE, NULL, TRUE
FROM ins
JOIN (VALUES
  ('Análisis granulométrico',            1.00::numeric),
  ('Cubicidad de partículas',            2.00::numeric),
  ('Equivalente de arena',               2.20::numeric),
  ('Extracción y preparación de muestras', 0.00::numeric)
) AS p(nombre, precio) ON p.nombre = ins.nombre_tipo_ensayo;

-- -----------------------------------------------------------------------------
-- Verificación rápida
-- -----------------------------------------------------------------------------
SELECT
  a.nombre_area,
  sa.nombre_subarea,
  COUNT(te.id) AS total_ensayos
FROM area_ensayo a
JOIN subarea_ensayo sa ON sa.area_id = a.id
JOIN tipo_ensayo te ON te.subarea_id = sa.id
GROUP BY a.nombre_area, sa.nombre_subarea
ORDER BY a.nombre_area, sa.nombre_subarea;

COMMIT;
