ALTER TABLE users
ADD COLUMN IF NOT EXISTS appearance_theme TEXT NOT NULL DEFAULT 'light'
CHECK (appearance_theme IN ('light', 'dark', 'auto'));
