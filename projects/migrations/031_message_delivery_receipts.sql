ALTER TABLE user_messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_messages_pending_delivery
  ON user_messages(recipient_id, delivered_at)
  WHERE delivered_at IS NULL;
