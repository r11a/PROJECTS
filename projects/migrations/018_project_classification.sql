ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_classification TEXT NOT NULL DEFAULT 'private_house';

CREATE INDEX IF NOT EXISTS idx_projects_classification
  ON projects(project_classification);
