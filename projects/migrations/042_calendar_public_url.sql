ALTER TABLE calendar_feed_tokens
  ADD COLUMN IF NOT EXISTS public_base_url TEXT;

