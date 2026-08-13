CREATE TABLE IF NOT EXISTS ai_chat_jobs (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','working','complete','error')),
  question TEXT NOT NULL,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_user_status ON ai_chat_jobs(user_id,status);
CREATE INDEX IF NOT EXISTS idx_ai_chat_jobs_expiry ON ai_chat_jobs(expires_at);
