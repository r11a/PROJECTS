ALTER TABLE project_time_entries DROP CONSTRAINT IF EXISTS project_time_entries_activity_type_check;
ALTER TABLE project_time_entries ADD CONSTRAINT project_time_entries_activity_type_check CHECK (activity_type IN
  ('general','planning','drawing','supervision','technician','threading','installation','programming','training'));

-- Only future task changes are synchronized. Never charge historical tasks at upgrade.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE OR REPLACE FUNCTION enable_completed_task_hours() RETURNS trigger AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.auto_hours_enabled := NEW.status='done';
  ELSE NEW.auto_hours_enabled := OLD.auto_hours_enabled OR (NEW.status='done' AND OLD.status<>'done'); END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS enable_completed_hours ON tasks;
CREATE TRIGGER enable_completed_hours BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION enable_completed_task_hours();

CREATE OR REPLACE FUNCTION sync_completed_task_hours() RETURNS trigger AS $$
DECLARE amount NUMERIC; activity TEXT; actor BIGINT; day_offset INTEGER := 0; work_day DATE;
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM project_time_entries WHERE source_type='task' AND source_id=OLD.id::text;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.status,NEW.project_id,NEW.duration_hours,NEW.estimated_hours,NEW.all_day,NEW.task_type,NEW.assignee_professional_id,NEW.assignee_id,NEW.start_date,NEW.due_date)
    IS NOT DISTINCT FROM (OLD.status,OLD.project_id,OLD.duration_hours,OLD.estimated_hours,OLD.all_day,OLD.task_type,OLD.assignee_professional_id,OLD.assignee_id,OLD.start_date,OLD.due_date) THEN RETURN NEW; END IF;
  DELETE FROM project_time_entries WHERE source_type='task' AND source_id=NEW.id::text;
  IF NEW.status<>'done' OR NEW.project_id IS NULL OR NOT NEW.auto_hours_enabled THEN RETURN NEW; END IF;
  amount := CASE WHEN NEW.all_day THEN 9 ELSE COALESCE(NULLIF(NEW.duration_hours,0),NEW.estimated_hours,0) END;
  IF amount<=0 THEN RETURN NEW; END IF;
  activity := CASE WHEN NEW.task_type IN ('supervision','inspection') THEN 'supervision'
    WHEN NEW.task_type IN ('planning','quotation','meeting') THEN 'planning'
    WHEN NEW.task_type IN ('installation','service') THEN 'installation' ELSE 'general' END;
  SELECT linked_user_id INTO actor FROM professionals WHERE id=NEW.assignee_professional_id;
  actor := COALESCE(actor,NEW.assignee_id,NEW.created_by);
  work_day := COALESCE(NEW.start_date,NEW.due_date,(NOW() AT TIME ZONE 'Asia/Jerusalem')::date);
  -- Long tasks are represented by daily chunks, preserving the configured total.
  WHILE amount>0 LOOP
    INSERT INTO project_time_entries(project_id,professional_id,user_id,activity_type,work_date,hours,source_type,source_id,notes)
    VALUES(NEW.project_id,NEW.assignee_professional_id,actor,activity,work_day+day_offset,LEAST(amount,9),'task',NEW.id::text,'משימה שהושלמה: '||NEW.title);
    amount := amount-9; day_offset := day_offset+1;
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS completed_task_hours ON tasks;
CREATE TRIGGER completed_task_hours AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION sync_completed_task_hours();
