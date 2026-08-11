ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(8,2) CHECK (estimated_hours IS NULL OR estimated_hours >= 0);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'task' CHECK (task_type IN ('task','service','procurement','followup'));

CREATE TABLE IF NOT EXISTS project_milestones (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','delayed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  owner_professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON tasks(project_id,status,due_date);
CREATE INDEX IF NOT EXISTS tasks_professional_idx ON tasks(assignee_professional_id,status);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON project_milestones(project_id,due_date);

CREATE OR REPLACE FUNCTION sync_milestone_calendar_history() RETURNS trigger AS $$
DECLARE item project_milestones%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN item := OLD; ELSE item := NEW; END IF;
  INSERT INTO calendar_history(source_type,source_id,title,event_at,status,project_id,user_id,color,icon,payload)
  VALUES('project_milestone',item.id::text,item.title,item.due_date::timestamptz,CASE WHEN TG_OP='DELETE' THEN 'deleted' ELSE item.status END,item.project_id,item.created_by,'#7c6cf2','flag',jsonb_build_object('progress',item.progress,'description',item.description,'operation',TG_OP))
  ON CONFLICT(source_type,source_id) DO UPDATE SET title=EXCLUDED.title,event_at=EXCLUDED.event_at,status=EXCLUDED.status,project_id=EXCLUDED.project_id,user_id=EXCLUDED.user_id,payload=EXCLUDED.payload,updated_at=NOW();
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS milestones_calendar_history ON project_milestones;
CREATE TRIGGER milestones_calendar_history AFTER INSERT OR UPDATE OR DELETE ON project_milestones FOR EACH ROW EXECUTE FUNCTION sync_milestone_calendar_history();

INSERT INTO project_milestones(project_id,title,due_date,status,progress,description)
SELECT id,next_milestone,to_date(due,'DD.MM.YYYY'),CASE WHEN health<70 THEN 'delayed' ELSE 'in_progress' END,progress,'נוצר מנתוני אבן הדרך הקיימים'
FROM projects p
WHERE btrim(next_milestone)<>'' AND due ~ '^\d{2}\.\d{2}\.\d{4}$'
  AND NOT EXISTS (SELECT 1 FROM project_milestones m WHERE m.project_id=p.id AND m.title=p.next_milestone);
