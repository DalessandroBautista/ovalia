-- Custom SQL migration file, put your code below! -----

-- Corrige el `tier` de competencias juveniles ya cargadas: hasta ahora la
-- columna quedaba en su default 'senior' para todas las filas, incluidas las
-- de categorías Menores, sin que hubiera ninguna barrera técnica que
-- impidiera cargar formaciones (listas de nombres de personas identificables)
-- para partidos de menores. La regla replica, en SQL, el clasificador puro
-- packages/domain/src/competition-tier.ts:
--   - contiene la palabra "menores" (insensible a mayúsculas/acentos), o
--   - contiene una abreviatura M15..M20 como palabra completa
--     (evita falsos positivos como "TOP 14" o "Primera 15").
--
-- unaccent() no está garantizado como extensión instalada en esta base, así
-- que se normalizan a mano los acentos más comunes en español antes de
-- comparar, en vez de asumir la extensión disponible.
UPDATE "competitions"
SET "tier" = 'youth'
WHERE "tier" <> 'youth'
  AND (
    translate(lower("name"), 'áéíóúñ', 'aeioun') ~ '\mmenores\M'
    OR translate(lower("name"), 'áéíóúñ', 'aeioun') ~ '\mm(1[5-9]|20)\M'
  );
