CREATE TABLE IF NOT EXISTS offline_operation_receipts (
  operation_id UUID PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed')),
  response_status INTEGER,
  response_body JSONB,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS offline_operation_receipts_created_idx ON offline_operation_receipts(created_at);

