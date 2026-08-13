ALTER TABLE users
ADD COLUMN IF NOT EXISTS merged_into_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_merged_into_idx
ON users(merged_into_user_id)
WHERE merged_into_user_id IS NOT NULL;
