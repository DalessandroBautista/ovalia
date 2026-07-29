WITH corrected AS (
  UPDATE "matches" AS match
  SET "source" = source."slug"
  FROM "external_sources" AS source
  WHERE match."source" = source."id"::text
  RETURNING match."source"
)
INSERT INTO "audit_log" ("action", "target_type", "metadata")
SELECT
  'migration.normalize_match_source',
  'matches',
  jsonb_build_object(
    'source', "source",
    'correctedRows', count(*),
    'reason', 'Replace external source UUID with its public slug'
  )
FROM corrected
GROUP BY "source";
