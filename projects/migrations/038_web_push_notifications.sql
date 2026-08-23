CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON push_subscriptions(user_id, active);

CREATE TABLE IF NOT EXISTS user_push_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  categories JSONB NOT NULL DEFAULT '{"tasks":true,"finance":true,"projects":true,"messages":true,"insights":true,"system":true}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_lists (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_list_members (
  list_id BIGINT NOT NULL REFERENCES notification_lists(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(list_id, user_id)
);

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system',
  target_url TEXT NOT NULL DEFAULT '',
  audience_type TEXT NOT NULL DEFAULT 'all' CHECK(audience_type IN ('all','selected','list','relevant')),
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','sending','sent','cancelled','failed')),
  smart BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_due ON notification_campaigns(status, scheduled_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES notification_campaigns(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  dedupe_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_dedupe
  ON notification_deliveries(user_id, subscription_id, dedupe_key) WHERE dedupe_key <> '';

INSERT INTO app_settings(key,value)
VALUES('pushNotifications','{"enabled":true,"categories":{"tasks":true,"finance":true,"projects":true,"messages":true,"insights":true,"system":true},"smart":{"overdueTasks":true,"paymentDue":true,"projectRisk":true}}'::jsonb)
ON CONFLICT(key) DO NOTHING;
