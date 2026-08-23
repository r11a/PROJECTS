ALTER TABLE user_push_preferences
  ADD COLUMN IF NOT EXISTS quiet_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_start TIME NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end TIME NOT NULL DEFAULT '07:00';

UPDATE app_settings
SET value=value || '{"quietHours":{"enabled":false,"start":"22:00","end":"07:00","timezone":"Asia/Jerusalem"}}'::jsonb,
    updated_at=NOW()
WHERE key='pushNotifications' AND NOT (value ? 'quietHours');
