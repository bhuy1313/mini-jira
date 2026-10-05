-- Mốc 17: PostgreSQL Full-text Search
-- Add search_vector column to task table
ALTER TABLE "task" ADD COLUMN "search_vector" tsvector;

-- Populate existing rows
UPDATE "task"
SET "search_vector" = to_tsvector('simple',
  coalesce(title, '') || ' ' || coalesce(description, '')
);

-- Create GIN index
CREATE INDEX "task_search_vector_gin_idx" ON "task" USING GIN ("search_vector");

-- Create trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION task_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to task table
CREATE TRIGGER task_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description
  ON "task"
  FOR EACH ROW EXECUTE FUNCTION task_search_vector_update();
