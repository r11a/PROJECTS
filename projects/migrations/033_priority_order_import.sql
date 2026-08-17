CREATE TABLE IF NOT EXISTS priority_orders (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  priority_order_number TEXT NOT NULL CHECK (btrim(priority_order_number) <> ''),
  priority_customer_number TEXT NOT NULL DEFAULT '',
  quotation_number TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  order_status TEXT NOT NULL DEFAULT '',
  order_description TEXT NOT NULL DEFAULT '',
  order_date DATE,
  supply_date DATE,
  gross_amount NUMERIC(16,2),
  discount_percent NUMERIC(8,3),
  net_amount NUMERIC(16,2),
  vat_amount NUMERIC(16,2),
  total_amount NUMERIC(16,2),
  purchase_cost NUMERIC(16,2),
  profit NUMERIC(16,2),
  source_filename TEXT NOT NULL DEFAULT '',
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, priority_order_number)
);

CREATE TABLE IF NOT EXISTS priority_order_lines (
  id BIGSERIAL PRIMARY KEY,
  priority_order_id BIGINT NOT NULL REFERENCES priority_orders(id) ON DELETE CASCADE,
  priority_sku TEXT NOT NULL DEFAULT '',
  original_description TEXT NOT NULL DEFAULT '',
  imported_description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(16,2),
  line_total NUMERIC(16,2),
  cost NUMERIC(16,2),
  barcode TEXT NOT NULL DEFAULT '',
  line_status TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL CHECK (classification IN ('equipment','material','installation_day','programming_day','service','description','ignore')),
  catalog_item_id BIGINT REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  project_system_id BIGINT REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  include_in_project BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_equipment BOOLEAN NOT NULL DEFAULT FALSE,
  include_in_reference_hours BOOLEAN NOT NULL DEFAULT FALSE,
  reference_hours NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(priority_order_id, sort_order)
);

ALTER TABLE project_equipment
  ADD COLUMN IF NOT EXISTS project_system_id BIGINT REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_priority_order_line_id BIGINT REFERENCES priority_order_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_ordered NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS source_unit TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS priority_orders_project_idx ON priority_orders(project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS priority_orders_project_number_ci_idx ON priority_orders(project_id, lower(priority_order_number));
CREATE INDEX IF NOT EXISTS priority_orders_client_idx ON priority_orders(client_id);
CREATE INDEX IF NOT EXISTS priority_order_lines_order_idx ON priority_order_lines(priority_order_id, sort_order);
CREATE INDEX IF NOT EXISTS priority_order_lines_sku_idx ON priority_order_lines(lower(priority_sku)) WHERE priority_sku <> '';
CREATE UNIQUE INDEX IF NOT EXISTS project_equipment_priority_line_idx
  ON project_equipment(source_priority_order_line_id)
  WHERE source_priority_order_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_equipment_system_idx ON project_equipment(project_id, project_system_id);
