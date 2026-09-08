ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN
  ('task','service','procurement','followup','supervision','inspection','meeting','planning','installation','quotation'));
ALTER TABLE project_time_entries DROP CONSTRAINT IF EXISTS project_time_entries_activity_type_check;
ALTER TABLE project_time_entries ADD CONSTRAINT project_time_entries_activity_type_check CHECK (activity_type IN
  ('planning','drawing','supervision','technician','installation','threading','programming','training'));
ALTER TABLE project_site_reviews ADD COLUMN IF NOT EXISTS plan_update_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE project_system_board ADD COLUMN IF NOT EXISTS category_name TEXT NOT NULL DEFAULT '';
