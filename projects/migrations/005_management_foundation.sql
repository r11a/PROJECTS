CREATE TABLE IF NOT EXISTS professional_role_types (
  id BIGSERIAL PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'user-round',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professionals (
  id BIGSERIAL PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (btrim(display_name) <> ''),
  company_name TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  affiliation TEXT NOT NULL DEFAULT 'external' CHECK (affiliation IN ('company','external')),
  employee_number TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  additional_phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  email TEXT NOT NULL DEFAULT '',
  additional_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'user-round',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  linked_user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  custom_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professional_role_assignments (
  professional_id BIGINT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  role_type_id BIGINT NOT NULL REFERENCES professional_role_types(id) ON DELETE RESTRICT,
  PRIMARY KEY(professional_id, role_type_id)
);

CREATE TABLE IF NOT EXISTS client_professionals (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  professional_id BIGINT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  role_type_id BIGINT NOT NULL REFERENCES professional_role_types(id) ON DELETE RESTRICT,
  is_referrer BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(client_id, professional_id, role_type_id)
);

CREATE TABLE IF NOT EXISTS project_professionals (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  professional_id BIGINT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  role_type_id BIGINT NOT NULL REFERENCES professional_role_types(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(project_id, professional_id, role_type_id)
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_manager_professional_idx ON projects(manager_professional_id);
CREATE INDEX IF NOT EXISTS professionals_search_idx ON professionals(display_name, company_name);
CREATE INDEX IF NOT EXISTS professional_roles_professional_idx ON professional_role_assignments(professional_id);

INSERT INTO professional_role_types(role_key,name,color,icon,sort_order) VALUES
('project_manager','מנהל פרויקט','#6957df','folder-kanban',10),
('technician','טכנאי','#2987e6','wrench',20),
('architect','אדריכל','#7c6cf2','ruler',30),
('supervisor','מפקח','#12a594','shield-check',40),
('electrician','חשמלאי','#e29b38','zap',50),
('designer','מעצב','#d95984','palette',60),
('supplier','ספק','#718096','truck',70)
ON CONFLICT(role_key) DO NOTHING;

INSERT INTO professionals(display_name,affiliation,job_title,color,icon)
SELECT DISTINCT btrim(manager),'company','מנהל פרויקט','#6957df','folder-kanban'
FROM projects
WHERE btrim(COALESCE(manager,'')) <> '';

INSERT INTO professional_role_assignments(professional_id,role_type_id)
SELECT p.id,r.id FROM professionals p CROSS JOIN professional_role_types r
WHERE r.role_key='project_manager' AND p.affiliation='company' AND p.job_title='מנהל פרויקט'
ON CONFLICT DO NOTHING;

UPDATE projects project
SET manager_professional_id=professional.id
FROM professionals professional
WHERE project.manager_professional_id IS NULL AND professional.display_name=project.manager AND professional.affiliation='company';

CREATE TABLE IF NOT EXISTS equipment_catalog (
  id BIGSERIAL PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('system_type','system','component')),
  parent_id BIGINT REFERENCES equipment_catalog(id) ON DELETE RESTRICT,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'יחידה',
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'cpu',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_type, parent_id, name)
);

CREATE TABLE IF NOT EXISTS project_equipment (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  catalog_item_id BIGINT NOT NULL REFERENCES equipment_catalog(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  serial_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equipment_catalog_parent_idx ON equipment_catalog(parent_id, item_type, active);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_catalog_identity_idx ON equipment_catalog(item_type,COALESCE(parent_id,0),lower(name));
CREATE INDEX IF NOT EXISTS project_equipment_project_idx ON project_equipment(project_id);

ALTER TABLE client_files ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS form_record_id BIGINT REFERENCES form_records(id) ON DELETE SET NULL;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS storage_area TEXT NOT NULL DEFAULT 'clients';
ALTER TABLE client_files ADD CONSTRAINT client_files_owner_required CHECK (client_id IS NOT NULL OR project_id IS NOT NULL OR form_record_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS client_files_project_idx ON client_files(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_files_form_idx ON client_files(form_record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_payments (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at DATE,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_updates (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_payments_project_idx ON project_payments(project_id, due_date);
CREATE INDEX IF NOT EXISTS project_updates_project_idx ON project_updates(project_id, created_at DESC);

INSERT INTO project_payments(project_id,title,amount,status,paid_at,notes)
SELECT id,'יתרת פתיחה',paid,'paid',CURRENT_DATE,'נוצר אוטומטית מהנתונים הקיימים'
FROM projects WHERE paid > 0
ON CONFLICT DO NOTHING;

INSERT INTO catalog_items(category,name,color,icon,symbol,sort_order,metadata) VALUES
('stage','תכנון','#7c6cf2','ruler','01',10,'{"key":"planning"}'),
('stage','תשתיות','#e29b38','zap','02',20,'{"key":"infrastructure"}'),
('stage','התקנה','#2987e6','wrench','03',30,'{"key":"installation"}'),
('stage','תכנות','#12a594','cpu','04',40,'{"key":"programming"}'),
('stage','לקראת מסירה','#d95984','clipboard-check','05',50,'{"key":"handover"}'),
('stage','הושלם','#1d9b66','check-circle','06',60,'{"key":"completed"}'),
('task_status','פתוחה','#718096','circle','',10,'{"key":"open"}'),
('task_status','בביצוע','#2987e6','clock','',20,'{"key":"in_progress"}'),
('task_status','הושלמה','#1d9b66','check-circle','',30,'{"key":"done"}'),
('flag','חריגה בלוח זמנים','#e05260','alert-triangle','!',30,'{}'),
('flag','תשלום באיחור','#d95984','credit-card','₪',40,'{}')
ON CONFLICT(category,name) DO NOTHING;
