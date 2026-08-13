CREATE OR REPLACE FUNCTION projects_generate_serial_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidate TEXT;
  counter INTEGER;
BEGIN
  candidate := substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1 + floor(random() * 26)::INTEGER, 1);
  FOR counter IN 1..6 LOOP
    candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::INTEGER, 1);
  END LOOP;
  RETURN candidate || floor(random() * 10)::INTEGER::TEXT;
END;
$$;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS serial_code VARCHAR(8);

DO $$
DECLARE
  project_record RECORD;
  candidate TEXT;
BEGIN
  FOR project_record IN SELECT id FROM projects WHERE serial_code IS NULL LOOP
    LOOP
      candidate := projects_generate_serial_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM projects WHERE serial_code = candidate);
    END LOOP;
    UPDATE projects SET serial_code = candidate WHERE id = project_record.id;
  END LOOP;
END;
$$;

ALTER TABLE projects ALTER COLUMN serial_code SET DEFAULT projects_generate_serial_code();
ALTER TABLE projects ALTER COLUMN serial_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_serial_code_unique_idx ON projects(serial_code);
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_serial_code_format;
ALTER TABLE projects ADD CONSTRAINT projects_serial_code_format CHECK (serial_code ~ '^[A-Z0-9]{8}$' AND serial_code ~ '[A-Z]' AND serial_code ~ '[0-9]');
