ALTER TABLE clients ADD COLUMN IF NOT EXISTS referral_source TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS critical BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS project_site_reviews (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  performed_by BIGINT REFERENCES professionals(id) ON DELETE SET NULL,
  supervision_type TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  follow_up TEXT NOT NULL DEFAULT '',
  plan_update_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_meeting_summaries (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_at TIMESTAMPTZ NOT NULL,
  attendees TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  follow_up TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_site_reviews_project ON project_site_reviews(project_id,review_date DESC);
CREATE INDEX IF NOT EXISTS idx_project_meetings_project ON project_meeting_summaries(project_id,meeting_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_files_recycle_bin ON client_files(deleted_at) WHERE deleted_at IS NOT NULL;
