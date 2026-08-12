ALTER TABLE clients ADD COLUMN IF NOT EXISTS priority_customer_number TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS clients_priority_customer_number_idx ON clients(priority_customer_number) WHERE priority_customer_number<>'';
INSERT INTO custom_field_definitions(entity_type,field_key,label,field_type,required,sort_order)
VALUES('client','priorityCustomerNumber','מספר לקוח בפריוריטי','text',FALSE,5)
ON CONFLICT(entity_type,field_key) DO UPDATE SET label=EXCLUDED.label,active=TRUE,sort_order=EXCLUDED.sort_order;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_size TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contractor_progress TEXT NOT NULL DEFAULT 'waiting';

CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_messages_recipient_idx ON user_messages(recipient_id,read_at,created_at DESC);

CREATE OR REPLACE FUNCTION notify_projects_live_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('projects_live_change', json_build_object('table',TG_TABLE_NAME,'operation',TG_OP)::text);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

DO $$ DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects','clients','client_contacts','tasks','project_milestones','project_payments','client_files','project_updates','calendar_events','form_records','project_equipment','user_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS projects_live_change ON %I',table_name);
    EXECUTE format('CREATE TRIGGER projects_live_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change()',table_name);
  END LOOP;
END $$;

UPDATE projects SET stage=CASE stage
  WHEN 'planning' THEN 'waiting'
  WHEN 'infrastructure' THEN 'infrastructure'
  WHEN 'installation' THEN 'installation_b'
  WHEN 'programming' THEN 'activation_programming'
  WHEN 'handover' THEN 'finishes'
  WHEN 'completed' THEN 'post_delivery'
  ELSE stage END;

UPDATE projects SET progress=CASE stage
  WHEN 'waiting' THEN 0 WHEN 'mobilization' THEN 9 WHEN 'infrastructure' THEN 18
  WHEN 'threading' THEN 27 WHEN 'electrician_threading' THEN 36 WHEN 'threading_done' THEN 45
  WHEN 'installation_a' THEN 55 WHEN 'installation_b' THEN 65 WHEN 'installation_c' THEN 75
  WHEN 'activation_programming' THEN 85 WHEN 'finishes' THEN 93 WHEN 'post_delivery' THEN 100
  ELSE progress END;

UPDATE catalog_items SET active=FALSE WHERE category='stage';
INSERT INTO catalog_items(category,name,color,icon,symbol,sort_order,metadata,active) VALUES
('stage','בהמתנה','#8b919e','clock','01',10,'{"key":"waiting","progress":0}',TRUE),
('stage','בהנעה','#7968e8','zap','02',20,'{"key":"mobilization","progress":9}',TRUE),
('stage','תשתיות','#d49235','network','03',30,'{"key":"infrastructure","progress":18}',TRUE),
('stage','השחלות','#c47b32','git-branch-plus','04',40,'{"key":"threading","progress":27}',TRUE),
('stage','השחלות ע״י חשמלאי','#ad7138','plug-zap','05',50,'{"key":"electrician_threading","progress":36}',TRUE),
('stage','בוצעו השחלות','#8d73d8','check-circle','06',60,'{"key":"threading_done","progress":45}',TRUE),
('stage','התקנות שלב א׳','#438be0','wrench','07',70,'{"key":"installation_a","progress":55}',TRUE),
('stage','התקנות שלב ב׳','#277fcf','wrench','08',80,'{"key":"installation_b","progress":65}',TRUE),
('stage','התקנות שלב ג׳','#146fbf','wrench','09',90,'{"key":"installation_c","progress":75}',TRUE),
('stage','הפעלות ותכנות','#12a594','cpu','10',100,'{"key":"activation_programming","progress":85}',TRUE),
('stage','פינישים','#d95984','sparkles','11',110,'{"key":"finishes","progress":93}',TRUE),
('stage','תוספות לאחר מסירה','#1d9b66','check-circle','12',120,'{"key":"post_delivery","progress":100}',TRUE)
ON CONFLICT(category,name) DO UPDATE SET color=EXCLUDED.color,icon=EXCLUDED.icon,symbol=EXCLUDED.symbol,sort_order=EXCLUDED.sort_order,metadata=EXCLUDED.metadata,active=TRUE;

CREATE OR REPLACE FUNCTION sync_task_calendar_history() RETURNS trigger AS $$
DECLARE item tasks%ROWTYPE; project_title TEXT;
BEGIN
  IF TG_OP='DELETE' THEN item := OLD; ELSE item := NEW; END IF;
  SELECT name INTO project_title FROM projects WHERE id=item.project_id;
  INSERT INTO calendar_history(source_type,source_id,title,event_at,status,client_id,project_id,user_id,color,icon,payload)
  VALUES('task',item.id::text,concat_ws(' — ',project_title,item.title),item.due_date::timestamptz,CASE WHEN TG_OP='DELETE' THEN 'deleted' ELSE item.status END,item.client_id,item.project_id,item.assignee_id,'#e29b38','check-square',jsonb_build_object('description',item.description,'priority',item.priority,'operation',TG_OP,'taskTitle',item.title,'projectName',project_title))
  ON CONFLICT(source_type,source_id) DO UPDATE SET title=EXCLUDED.title,event_at=EXCLUDED.event_at,status=EXCLUDED.status,client_id=EXCLUDED.client_id,project_id=EXCLUDED.project_id,user_id=EXCLUDED.user_id,payload=EXCLUDED.payload,updated_at=NOW();
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

UPDATE calendar_history h SET title=concat_ws(' — ',p.name,t.title),payload=h.payload||jsonb_build_object('taskTitle',t.title,'projectName',p.name)
FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
WHERE h.source_type='task' AND h.source_id=t.id::text;
