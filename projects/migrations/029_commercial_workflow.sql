ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS finance_access BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid
  WHERE t.relname='users' AND c.contype='c' AND pg_get_constraintdef(c.oid) ILIKE '%role%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','manager','supervisor','technician','finance','viewer','custom'));

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_icon TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS project_color TEXT NOT NULL DEFAULT '#6957df',
  ADD COLUMN IF NOT EXISTS installation_lead_professional_id BIGINT REFERENCES professionals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finance_mode TEXT NOT NULL DEFAULT 'total' CHECK (finance_mode IN ('total','systems')),
  ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS projects_completion_idx ON projects(completed_at,archived_at);
CREATE INDEX IF NOT EXISTS projects_installation_lead_idx ON projects(installation_lead_professional_id);

ALTER TABLE equipment_catalog
  ADD COLUMN IF NOT EXISTS priority_sku TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS equipment_catalog_priority_sku_idx
  ON equipment_catalog(priority_sku) WHERE priority_sku<>'';
