CREATE TABLE IF NOT EXISTS ai_usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL CHECK (feature IN ('chat','insights')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_feature_idx ON ai_usage_log(feature,created_at DESC);

DROP TRIGGER IF EXISTS projects_live_change ON ai_usage_log;
CREATE TRIGGER projects_live_change AFTER INSERT OR UPDATE OR DELETE ON ai_usage_log
FOR EACH STATEMENT EXECUTE FUNCTION notify_projects_live_change();
