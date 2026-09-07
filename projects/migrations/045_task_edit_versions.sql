-- A version changes for every writer, including automations and offline replay.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
CREATE OR REPLACE FUNCTION advance_task_version() RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tasks_edit_version ON tasks;
CREATE TRIGGER tasks_edit_version BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION advance_task_version();
