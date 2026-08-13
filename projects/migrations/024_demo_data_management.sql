ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE projects
SET is_demo = TRUE
WHERE id IN ('PRJ-1048','PRJ-1043','PRJ-1039','PRJ-1052','PRJ-1027','PRJ-1016');

INSERT INTO app_settings(key,value)
VALUES ('demoData', '{"enabled":true}'::jsonb)
ON CONFLICT(key) DO NOTHING;
