-- Preserve existing task types while enabling the type already offered by the UI.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN
  ('task','service','procurement','followup','supervision','inspection','meeting','planning','installation','activation','quotation'));
