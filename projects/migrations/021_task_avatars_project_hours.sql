ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS project_time_entries (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('planning','supervision','technician','installation','threading','programming','training')),
  work_date DATE NOT NULL,
  hours NUMERIC(7,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project ON project_time_entries(project_id,work_date DESC);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS installation_hours_target NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS programming_hours_target NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE form_records ADD COLUMN IF NOT EXISTS activity_type TEXT;
ALTER TABLE form_records ADD COLUMN IF NOT EXISTS work_hours NUMERIC(7,2) NOT NULL DEFAULT 0;
ALTER TABLE form_records ADD COLUMN IF NOT EXISTS professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL;
