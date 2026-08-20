-- Multi-assignee tasks and the extended commercial task taxonomy.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('task','service','procurement','followup','supervision','inspection','meeting'));

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  professional_id BIGINT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY(task_id, professional_id)
);
CREATE INDEX IF NOT EXISTS task_assignees_professional_idx
  ON task_assignees(professional_id, task_id);

-- Preserve the existing primary performer as the first member of the new collection.
INSERT INTO task_assignees(task_id, professional_id, assigned_by)
SELECT id, assignee_professional_id, created_by
FROM tasks
WHERE assignee_professional_id IS NOT NULL
ON CONFLICT DO NOTHING;
