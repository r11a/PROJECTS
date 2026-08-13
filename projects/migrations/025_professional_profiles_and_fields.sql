ALTER TABLE professionals ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

UPDATE professionals
SET first_name = CASE
      WHEN position(' ' IN btrim(display_name)) > 0 THEN left(btrim(display_name), length(btrim(display_name)) - length(regexp_replace(btrim(display_name), '^.*\s', '')) - 1)
      ELSE btrim(display_name)
    END,
    last_name = CASE
      WHEN position(' ' IN btrim(display_name)) > 0 THEN regexp_replace(btrim(display_name), '^.*\s', '')
      ELSE ''
    END
WHERE first_name = '' AND last_name = '';

ALTER TABLE custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_entity_type_check;
ALTER TABLE custom_field_definitions
  ADD CONSTRAINT custom_field_definitions_entity_type_check
  CHECK (entity_type IN ('client','project','task','inspection','professional'));
