CREATE TABLE IF NOT EXISTS priority_sku_system_mappings (
  id BIGSERIAL PRIMARY KEY,
  priority_sku TEXT NOT NULL,
  system_id BIGINT NOT NULL REFERENCES equipment_catalog(id) ON DELETE CASCADE,
  catalog_item_id BIGINT REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  learned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS priority_sku_system_mapping_ci
  ON priority_sku_system_mappings(lower(priority_sku));

ALTER TABLE project_equipment
  ADD COLUMN IF NOT EXISTS quantity_installed NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_installed >= 0),
  ADD COLUMN IF NOT EXISTS quantity_programmed NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_programmed >= 0);

CREATE TABLE IF NOT EXISTS meeting_task_links (
  meeting_id BIGINT NOT NULL REFERENCES project_meeting_summaries(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(meeting_id, task_id)
);

CREATE TABLE IF NOT EXISTS voice_notes (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL DEFAULT 'voice-note.webm',
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  duration_seconds NUMERIC(6,2) NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 60.5),
  transcript TEXT NOT NULL DEFAULT '',
  ai_summary TEXT NOT NULL DEFAULT '',
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS voice_notes_entity_idx ON voice_notes(entity_type,entity_id,created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS voice_notes_project_idx ON voice_notes(project_id,created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_playback_rate NUMERIC(3,2) NOT NULL DEFAULT 1.0;
