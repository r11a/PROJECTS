CREATE TABLE IF NOT EXISTS ai_provider_settings (
  provider TEXT PRIMARY KEY CHECK (provider IN ('gemini', 'openai')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  model TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('success', 'error') OR last_test_status IS NULL),
  last_test_error TEXT,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_provider_settings(provider, model)
VALUES
  ('gemini', 'gemini-3.5-flash-lite'),
  ('openai', 'gpt-5.6-luna')
ON CONFLICT(provider) DO NOTHING;

INSERT INTO app_settings(key, value)
VALUES ('ai', '{"activeProvider":"gemini","monthlyBudgetUsd":10,"readOnly":true}'::jsonb)
ON CONFLICT(key) DO NOTHING;
