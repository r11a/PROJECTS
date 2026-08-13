UPDATE users primary_user
SET avatar_image = (
      SELECT merged.avatar_image
      FROM users merged
      WHERE merged.merged_into_user_id = primary_user.id
        AND merged.avatar_image <> ''
      ORDER BY merged.updated_at DESC
      LIMIT 1
    ),
    updated_at = NOW()
WHERE primary_user.merged_into_user_id IS NULL
  AND primary_user.avatar_image = ''
  AND EXISTS (
    SELECT 1 FROM users merged
    WHERE merged.merged_into_user_id = primary_user.id
      AND merged.avatar_image <> ''
  );
