CREATE TABLE IF NOT EXISTS project_table_imports (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  mapping JSONB NOT NULL,
  summary JSONB NOT NULL,
  token UUID NOT NULL UNIQUE,
  file_id BIGINT REFERENCES client_files(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_table_import_rows (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  equipment_id BIGINT REFERENCES project_equipment(id) ON DELETE SET NULL,
  task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
  source_values JSONB NOT NULL DEFAULT '{}',
  overrides JSONB NOT NULL DEFAULT '{}',
  import_id BIGINT REFERENCES project_table_imports(id) ON DELETE SET NULL,
  PRIMARY KEY(project_id,source_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS table_import_equipment_unique ON project_table_import_rows(equipment_id) WHERE equipment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS table_import_task_unique ON project_table_import_rows(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS table_import_project_history ON project_table_imports(project_id,created_at DESC);
