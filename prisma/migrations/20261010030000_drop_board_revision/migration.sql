-- Orphan column from an earlier out-of-band change: absent from the schema
-- and referenced by no code. Dropped so databases converge exactly.
ALTER TABLE "project" DROP COLUMN IF EXISTS "boardRevision";
