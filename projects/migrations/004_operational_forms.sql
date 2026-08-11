CREATE TABLE IF NOT EXISTS form_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  color TEXT NOT NULL DEFAULT '#6957df',
  icon TEXT NOT NULL DEFAULT 'clipboard-check',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_records (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL DEFAULT 1,
  template_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','approved')),
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  scheduled_for DATE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  completed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_templates_active_idx ON form_templates(active, updated_at DESC);
CREATE INDEX IF NOT EXISTS form_records_status_idx ON form_records(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS form_records_project_idx ON form_records(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS form_records_client_idx ON form_records(client_id, updated_at DESC);

INSERT INTO form_templates(name, description, category, color, icon, fields) VALUES
('ביקורת אתר', 'תיעוד מצב התשתיות, ליקויים והנחיות להמשך ביצוע', 'inspection', '#2987e6', 'shield',
 '[{"id":"visit_date","label":"תאריך ביקור","type":"date","required":true},{"id":"participants","label":"משתתפים","type":"text","required":false},{"id":"infrastructure","label":"מצב תשתיות","type":"select","required":true,"options":["תקין","נדרשים תיקונים","לא מוכן"]},{"id":"findings","label":"ממצאים וליקויים","type":"textarea","required":true},{"id":"photos_required","label":"נדרש תיעוד צילום","type":"checkbox","required":false},{"id":"next_visit","label":"ביקור הבא","type":"date","required":false}]'::jsonb),
('פרוטוקול מסירה', 'בדיקות סופיות, הדרכת לקוח ואישור מסירת המערכות', 'handover', '#12a594', 'check-circle',
 '[{"id":"handover_date","label":"תאריך מסירה","type":"date","required":true},{"id":"systems_tested","label":"מערכות שנבדקו","type":"textarea","required":true},{"id":"training","label":"בוצעה הדרכת לקוח","type":"checkbox","required":true},{"id":"open_items","label":"נושאים פתוחים","type":"textarea","required":false},{"id":"customer_name","label":"שם נציג הלקוח","type":"text","required":true}]'::jsonb),
('אישור תשתיות', 'אישור מוכנות צנרת, ארונות, חשמל ותקשורת לפני התקנה', 'infrastructure', '#e29b38', 'zap',
 '[{"id":"inspection_date","label":"תאריך בדיקה","type":"date","required":true},{"id":"electrical_ready","label":"חשמל מוכן","type":"checkbox","required":true},{"id":"network_ready","label":"תקשורת מוכנה","type":"checkbox","required":true},{"id":"cabinet_ready","label":"ארונות ושטחי ציוד מוכנים","type":"checkbox","required":true},{"id":"exceptions","label":"חריגים והערות","type":"textarea","required":false}]'::jsonb),
('שינוי לקוח', 'תיעוד בקשת שינוי, משמעות תקציבית ואישור לביצוע', 'change_order', '#d95984', 'file-text',
 '[{"id":"request_date","label":"תאריך בקשה","type":"date","required":true},{"id":"requested_change","label":"תיאור השינוי","type":"textarea","required":true},{"id":"cost_impact","label":"השפעה כספית","type":"number","required":false},{"id":"schedule_impact","label":"השפעה על לוח הזמנים","type":"text","required":false},{"id":"approved","label":"אושר לביצוע","type":"checkbox","required":false}]'::jsonb)
ON CONFLICT DO NOTHING;
