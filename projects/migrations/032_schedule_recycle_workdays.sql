ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recycle_bin (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  project_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  restored_at TIMESTAMPTZ,
  restored_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS recycle_bin_active_idx ON recycle_bin(purge_at) WHERE restored_at IS NULL;
INSERT INTO app_settings(key,value) VALUES ('workCalendar','{"includeFriday":false,"includeSaturday":false,"timezone":"Asia/Jerusalem"}'::jsonb) ON CONFLICT(key) DO NOTHING;
