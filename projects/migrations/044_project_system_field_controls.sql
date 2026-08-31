ALTER TABLE project_system_columns
  ADD COLUMN IF NOT EXISTS column_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE project_equipment
  ADD COLUMN IF NOT EXISTS sku_override TEXT NOT NULL DEFAULT '';

ALTER TABLE project_system_columns DROP CONSTRAINT IF EXISTS project_system_columns_type_check;
ALTER TABLE project_system_columns ADD CONSTRAINT project_system_columns_type_check CHECK (column_type IN ('text','number','status'));

CREATE TABLE IF NOT EXISTS project_system_field_settings (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id,field_key)
);

DROP TRIGGER IF EXISTS projects_live_change ON project_system_field_settings;
CREATE TRIGGER projects_live_change AFTER INSERT OR UPDATE OR DELETE ON project_system_field_settings
FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change();
