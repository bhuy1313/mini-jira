-- Backfill: existing "Done" statuses should count toward sprint progress.
UPDATE "status"
SET "isDone" = true
WHERE "isDone" = false
  AND LOWER("name") IN ('done');