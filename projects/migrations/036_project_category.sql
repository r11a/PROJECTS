ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_category TEXT NOT NULL DEFAULT 'smart_home',
  ADD COLUMN IF NOT EXISTS project_category_custom TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS project_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE projects SET project_category='smart_home' WHERE project_category IS NULL OR project_category NOT IN ('smart_home','other');

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_category_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_category_check CHECK (project_category IN ('smart_home','other'));
CREATE INDEX IF NOT EXISTS projects_project_category_idx ON projects(project_category) WHERE archived_at IS NULL;
