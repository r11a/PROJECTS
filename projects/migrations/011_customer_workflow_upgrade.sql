ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS apartment_number TEXT NOT NULL DEFAULT '';

UPDATE clients SET first_name=name WHERE first_name='' AND last_name='';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS document_folder TEXT NOT NULL DEFAULT '';

ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS hidden_for BIGINT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS user_messages_hidden_for_idx ON user_messages USING GIN(hidden_for);

CREATE TABLE IF NOT EXISTS user_alert_dismissals (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,alert_key)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE catalog_items SET active=FALSE WHERE category='stage' AND metadata->>'key'='electrician_threading';
UPDATE catalog_items
SET name='מוכן למסירה', description='הפרויקט הושלם ומוכן למסירה ללקוח', updated_at=NOW()
WHERE category='stage' AND metadata->>'key'='post_delivery';
UPDATE projects SET stage='threading_done',progress=45 WHERE stage='electrician_threading';

