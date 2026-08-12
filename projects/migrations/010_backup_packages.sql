UPDATE app_settings
SET value = value || '{"destination":"internal","relativePath":"PROJECTS/Backups"}'::jsonb,
    updated_at = NOW()
WHERE key = 'backupPolicy';
