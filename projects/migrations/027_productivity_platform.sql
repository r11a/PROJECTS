ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_capacity_hours NUMERIC(6,2) NOT NULL DEFAULT 40 CHECK (weekly_capacity_hours >= 0);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id BIGINT;

CREATE TABLE IF NOT EXISTS saved_views (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace TEXT NOT NULL,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,workspace,name)
);

CREATE TABLE IF NOT EXISTS project_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  description TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT 'private_house',
  default_stage TEXT NOT NULL DEFAULT 'waiting',
  installation_hours_target NUMERIC(8,2) NOT NULL DEFAULT 0,
  programming_hours_target NUMERIC(8,2) NOT NULL DEFAULT 0,
  folder_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT projects_template_fk FOREIGN KEY(template_id) REFERENCES project_templates(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS project_template_tasks (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  description TEXT NOT NULL DEFAULT '',
  start_offset_days INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days > 0),
  priority TEXT NOT NULL DEFAULT 'normal',
  task_type TEXT NOT NULL DEFAULT 'task',
  critical BOOLEAN NOT NULL DEFAULT FALSE,
  dependency_position INTEGER,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('project_created','project_stage_changed','task_created','task_status_changed','task_overdue')),
  trigger_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT REFERENCES automation_rules(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_baselines (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Baseline ראשי',
  snapshot JSONB NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_change_requests (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','implemented')),
  price_impact NUMERIC(14,2) NOT NULL DEFAULT 0,
  schedule_impact_days INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL DEFAULT '',
  decision_notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_views_user_workspace_idx ON saved_views(user_id,workspace);
CREATE INDEX IF NOT EXISTS project_template_tasks_template_idx ON project_template_tasks(template_id,position);
CREATE INDEX IF NOT EXISTS automation_rules_trigger_idx ON automation_rules(trigger_type,active);
CREATE INDEX IF NOT EXISTS automation_rules_trigger_types_gin_idx ON automation_rules USING gin (trigger_types);
CREATE INDEX IF NOT EXISTS project_baselines_project_idx ON project_baselines(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS project_changes_project_idx ON project_change_requests(project_id,status,created_at DESC);

UPDATE automation_rules SET trigger_types = jsonb_build_array(trigger_type) WHERE trigger_types = '[]'::jsonb OR trigger_types IS NULL;

INSERT INTO project_templates(name,description,classification,installation_hours_target,programming_hours_target,folder_structure)
VALUES
('בית חכם בסיסי','תהליך אחיד לבית חכם קטן עד בינוני','private_house',32,12,'["01 תוכניות","02 הצעות והזמנות","03 תמונות אתר","04 תכנות","05 מסירה"]'),
('וילה חכמה מלאה','פרויקט רב מערכתי הכולל תשתיות, התקנות, תכנות ומסירה','villa',120,48,'["01 אפיון","02 תוכניות","03 תשתיות","04 התקנות","05 תוכנה","06 בדיקות","07 מסירה"]'),
('מצלמות ומתח נמוך','פרויקט מצלמות, תקשורת, אזעקה ואינטרקום','private_house',48,10,'["01 סקר אתר","02 תוכניות","03 ציוד","04 התקנה","05 מסירה"]')
ON CONFLICT(name) DO NOTHING;

INSERT INTO project_template_tasks(template_id,title,start_offset_days,duration_days,priority,task_type,critical,position)
SELECT t.id,v.title,v.offset_days,v.duration,v.priority,v.task_type,v.critical,v.position
FROM project_templates t JOIN (VALUES
('בית חכם בסיסי','פגישת אפיון ודרישות',0,2,'high','task',true,1),
('בית חכם בסיסי','הכנת תכנית נקודות',2,5,'high','task',true,2),
('בית חכם בסיסי','ביקורת תשתיות',10,1,'normal','task',false,3),
('בית חכם בסיסי','התקנות ותכנות',20,5,'high','task',true,4),
('בית חכם בסיסי','בדיקות, הדרכה ומסירה',27,2,'high','task',true,5),
('וילה חכמה מלאה','ישיבת התנעה ואפיון',0,3,'high','task',true,1),
('וילה חכמה מלאה','תכנון מערכות ותיאום אדריכלי',3,10,'high','task',true,2),
('וילה חכמה מלאה','השחלות וביקורות תשתית',18,8,'high','task',true,3),
('וילה חכמה מלאה','התקנות שלב א–ג',35,15,'high','task',true,4),
('וילה חכמה מלאה','תכנות, הפעלות ופינישים',52,10,'high','task',true,5),
('וילה חכמה מלאה','בדיקות ומסירה',65,3,'high','task',true,6),
('מצלמות ומתח נמוך','סקר אתר ותכנון פריסה',0,3,'high','task',true,1),
('מצלמות ומתח נמוך','אישור ציוד והזמנה',3,3,'normal','procurement',false,2),
('מצלמות ומתח נמוך','תשתיות והתקנה',10,5,'high','task',true,3),
('מצלמות ומתח נמוך','הגדרות, בדיקות ומסירה',16,3,'high','task',true,4)
) AS v(template_name,title,offset_days,duration,priority,task_type,critical,position) ON v.template_name=t.name
WHERE NOT EXISTS(SELECT 1 FROM project_template_tasks x WHERE x.template_id=t.id);
