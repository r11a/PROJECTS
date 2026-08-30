ALTER TABLE project_equipment
  ADD COLUMN IF NOT EXISTS board_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS row_color TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_values JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS project_system_board (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  system_id BIGINT NOT NULL REFERENCES equipment_catalog(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6957df',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id,system_id)
);

CREATE TABLE IF NOT EXISTS project_system_columns (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id,column_key)
);

CREATE INDEX IF NOT EXISTS project_equipment_board_order_idx ON project_equipment(project_id,project_system_id,board_order,id);

DROP TRIGGER IF EXISTS projects_live_change ON project_system_board;
CREATE TRIGGER projects_live_change AFTER INSERT OR UPDATE OR DELETE ON project_system_board
FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change();
DROP TRIGGER IF EXISTS projects_live_change ON project_system_columns;
CREATE TRIGGER projects_live_change AFTER INSERT OR UPDATE OR DELETE ON project_system_columns
FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change();
