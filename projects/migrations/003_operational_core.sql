CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#6957df';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_icon TEXT NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS catalog_items (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('stage','system','tag','flag','priority','contact_role','task_status','inspection_template')),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'circle',
  symbol TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, name)
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'private',
  company_number TEXT NOT NULL DEFAULT '',
  primary_contact_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  additional_phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  email TEXT NOT NULL DEFAULT '',
  additional_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  custom_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients ADD CONSTRAINT clients_name_required CHECK (btrim(name) <> '');
ALTER TABLE clients ADD CONSTRAINT clients_address_required CHECK (btrim(address) <> '');
ALTER TABLE clients ADD CONSTRAINT clients_phone_required CHECK (btrim(phone) <> '');

CREATE TABLE IF NOT EXISTS client_contacts (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'other',
  phone TEXT NOT NULL DEFAULT '',
  additional_phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  email TEXT NOT NULL DEFAULT '',
  is_referrer BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_labels (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  catalog_item_id BIGINT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  PRIMARY KEY(client_id, catalog_item_id)
);

CREATE TABLE IF NOT EXISTS client_files (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_inspections (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'ביקורת אתר',
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspector_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (client_id IS NOT NULL OR project_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client','project','task','inspection')),
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','select','boolean','url','phone','email')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(entity_type, field_key)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'general',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'calendar',
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_history (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL,
  event_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  client_id BIGINT,
  project_id TEXT,
  user_id BIGINT,
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'calendar',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

CREATE TABLE IF NOT EXISTS user_alert_snoozes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL,
  snoozed_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, alert_key)
);

CREATE OR REPLACE FUNCTION sync_task_calendar_history() RETURNS trigger AS $$
DECLARE item tasks%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN item := OLD; ELSE item := NEW; END IF;
  INSERT INTO calendar_history(source_type,source_id,title,event_at,status,client_id,project_id,user_id,color,icon,payload)
  VALUES('task',item.id::text,item.title,item.due_date::timestamptz,CASE WHEN TG_OP='DELETE' THEN 'deleted' ELSE item.status END,item.client_id,item.project_id,item.assignee_id,'#e29b38','check-square',jsonb_build_object('description',item.description,'priority',item.priority,'operation',TG_OP))
  ON CONFLICT(source_type,source_id) DO UPDATE SET title=EXCLUDED.title,event_at=EXCLUDED.event_at,status=EXCLUDED.status,client_id=EXCLUDED.client_id,project_id=EXCLUDED.project_id,user_id=EXCLUDED.user_id,payload=EXCLUDED.payload,updated_at=NOW();
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_inspection_calendar_history() RETURNS trigger AS $$
DECLARE item site_inspections%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN item := OLD; ELSE item := NEW; END IF;
  INSERT INTO calendar_history(source_type,source_id,title,event_at,status,client_id,project_id,user_id,color,icon,payload)
  VALUES('inspection',item.id::text,item.title,item.inspection_date::timestamptz,CASE WHEN TG_OP='DELETE' THEN 'deleted' ELSE item.status END,item.client_id,item.project_id,item.created_by,'#2987e6','shield',jsonb_build_object('score',item.score,'notes',item.notes,'inspector',item.inspector_name,'operation',TG_OP))
  ON CONFLICT(source_type,source_id) DO UPDATE SET title=EXCLUDED.title,event_at=EXCLUDED.event_at,status=EXCLUDED.status,client_id=EXCLUDED.client_id,project_id=EXCLUDED.project_id,user_id=EXCLUDED.user_id,payload=EXCLUDED.payload,updated_at=NOW();
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_manual_calendar_history() RETURNS trigger AS $$
DECLARE item calendar_events%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN item := OLD; ELSE item := NEW; END IF;
  INSERT INTO calendar_history(source_type,source_id,title,event_at,event_end,status,client_id,project_id,user_id,color,icon,payload)
  VALUES('event',item.id::text,item.title,item.start_at,item.end_at,CASE WHEN TG_OP='DELETE' THEN 'deleted' ELSE 'active' END,item.client_id,item.project_id,item.assignee_id,item.color,item.icon,jsonb_build_object('type',item.event_type,'notes',item.notes,'allDay',item.all_day,'operation',TG_OP))
  ON CONFLICT(source_type,source_id) DO UPDATE SET title=EXCLUDED.title,event_at=EXCLUDED.event_at,event_end=EXCLUDED.event_end,status=EXCLUDED.status,client_id=EXCLUDED.client_id,project_id=EXCLUDED.project_id,user_id=EXCLUDED.user_id,color=EXCLUDED.color,icon=EXCLUDED.icon,payload=EXCLUDED.payload,updated_at=NOW();
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION sync_project_calendar_history() RETURNS trigger AS $$
DECLARE item projects%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN item := OLD; ELSE item := NEW; END IF;
  IF item.due ~ '^\d{2}\.\d{2}\.\d{4}$' THEN
    INSERT INTO calendar_history(source_type,source_id,title,event_at,status,client_id,project_id,color,icon,payload)
    VALUES('milestone',item.id,item.next_milestone,to_date(item.due,'DD.MM.YYYY')::timestamptz,CASE WHEN TG_OP='DELETE' THEN 'deleted' ELSE item.stage END,item.client_id,item.id,'#7c6cf2','flag',jsonb_build_object('projectName',item.name,'manager',item.manager,'operation',TG_OP))
    ON CONFLICT(source_type,source_id) DO UPDATE SET title=EXCLUDED.title,event_at=EXCLUDED.event_at,status=EXCLUDED.status,client_id=EXCLUDED.client_id,payload=EXCLUDED.payload,updated_at=NOW();
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_calendar_history ON tasks;
CREATE TRIGGER tasks_calendar_history AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION sync_task_calendar_history();
DROP TRIGGER IF EXISTS inspections_calendar_history ON site_inspections;
CREATE TRIGGER inspections_calendar_history AFTER INSERT OR UPDATE OR DELETE ON site_inspections FOR EACH ROW EXECUTE FUNCTION sync_inspection_calendar_history();
DROP TRIGGER IF EXISTS events_calendar_history ON calendar_events;
CREATE TRIGGER events_calendar_history AFTER INSERT OR UPDATE OR DELETE ON calendar_events FOR EACH ROW EXECUTE FUNCTION sync_manual_calendar_history();
DROP TRIGGER IF EXISTS projects_calendar_history ON projects;
CREATE TRIGGER projects_calendar_history AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION sync_project_calendar_history();

INSERT INTO app_settings(key, value) VALUES
  ('company', '{"name":"Smart Home Israel","phone":"","email":"","address":"","companyNumber":"","logo":""}'),
  ('localization', '{"currency":"ILS","vatRate":18,"timezone":"Asia/Jerusalem","dateFormat":"DD.MM.YYYY"}'),
  ('projectNumbering', '{"prefix":"PRJ","includeYear":true,"nextNumber":1}'),
  ('map', '{"provider":"openstreetmap","addressProvider":"photon","photonUrl":"https://photon.komoot.io","addressLanguage":"default","defaultLat":32.0853,"defaultLng":34.7818,"defaultZoom":10}'),
  ('notifications', '{"taskDue":true,"paymentDue":true,"milestoneRisk":true,"emailEnabled":false}'),
  ('backupPolicy', '{"enabled":true,"frequency":"daily","retention":14,"hour":"02:00","destination":"internal","relativePath":"PROJECTS/Backups"}')
ON CONFLICT(key) DO NOTHING;

INSERT INTO catalog_items(category, name, color, icon, symbol, sort_order) VALUES
  ('tag','VIP','#7c6cf2','star','★',10), ('tag','פרויקט חוזר','#12a594','repeat','↻',20),
  ('flag','דורש טיפול','#e05260','flag','!',10), ('flag','המתנה ללקוח','#e29b38','clock','◷',20),
  ('system','KNX','#6b59dc','cpu','KNX',10), ('system','Control4','#2987e6','sliders','C4',20),
  ('system','Home Assistant','#12a594','home','HA',30), ('system','CCTV','#d95984','camera','CCTV',40),
  ('system','תקשורת ורשת','#e29b38','network','LAN',50), ('system','אודיו וידאו','#805ad5','speaker','AV',60),
  ('contact_role','אדריכל','#7c6cf2','ruler','אדר׳',10), ('contact_role','חשמלאי','#e29b38','zap','חש׳',20),
  ('contact_role','מפקח','#2987e6','shield','מפקח',30), ('contact_role','קבלן','#12a594','hard-hat','קבלן',40),
  ('contact_role','מעצב פנים','#d95984','palette','עיצוב',50),
  ('priority','רגילה','#718096','circle','',10), ('priority','גבוהה','#e29b38','arrow-up','!',20),
  ('priority','קריטית','#e05260','alert-triangle','!!',30)
ON CONFLICT(category, name) DO NOTHING;

CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(name);
CREATE INDEX IF NOT EXISTS clients_updated_idx ON clients(updated_at DESC);
CREATE INDEX IF NOT EXISTS client_contacts_client_idx ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS client_contacts_name_idx ON client_contacts(name);
CREATE INDEX IF NOT EXISTS tasks_client_idx ON tasks(client_id, status);
CREATE INDEX IF NOT EXISTS inspections_client_idx ON site_inspections(client_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS catalog_category_idx ON catalog_items(category, active, sort_order);
CREATE INDEX IF NOT EXISTS calendar_events_start_idx ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS calendar_history_event_idx ON calendar_history(event_at);
CREATE INDEX IF NOT EXISTS calendar_history_project_idx ON calendar_history(project_id,event_at);

WITH project_clients AS (
  SELECT client, MIN(phone) AS phone, MIN(email) AS email, MIN(address) AS address,
         ROW_NUMBER() OVER (ORDER BY client) + 1000 AS sequence
  FROM projects
  WHERE client <> ''
  GROUP BY client
)
INSERT INTO clients(code, name, primary_contact_name, phone, email, address)
SELECT 'CUS-' || sequence, client, client, phone, email, address
FROM project_clients
ON CONFLICT(code) DO NOTHING;

UPDATE projects p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL AND p.client = c.name;

INSERT INTO calendar_history(source_type,source_id,title,event_at,status,client_id,project_id,color,icon,payload)
SELECT 'milestone',p.id,p.next_milestone,to_date(p.due,'DD.MM.YYYY')::timestamptz,p.stage,p.client_id,p.id,'#7c6cf2','flag',jsonb_build_object('projectName',p.name,'manager',p.manager,'operation','MIGRATION')
FROM projects p WHERE p.due ~ '^\d{2}\.\d{2}\.\d{4}$'
ON CONFLICT(source_type,source_id) DO NOTHING;
