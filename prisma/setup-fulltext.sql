-- Ensure GIN index exists for full-text search
CREATE INDEX IF NOT EXISTS "task_search_vector_gin_idx" ON "task" USING GIN ("search_vector");

-- Create or update trigger function
CREATE OR REPLACE FUNCTION task_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger safely
DROP TRIGGER IF EXISTS task_search_vector_trigger ON "task";
CREATE TRIGGER task_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description
  ON "task"
  FOR EACH ROW EXECUTE FUNCTION task_search_vector_update();
