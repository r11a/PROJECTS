ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_archived_at_idx ON projects(archived_at);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects(client_id);

-- Repair legacy rows where a client already exists but the project only kept its name as text.
UPDATE projects p
SET client_id = c.id,
    client = c.name,
    updated_at = NOW()
FROM clients c
WHERE p.client_id IS NULL
  AND lower(btrim(p.client)) = lower(btrim(c.name));

-- Keep the legacy display column synchronized for every linked project.
UPDATE projects p
SET client = c.name,
    updated_at = NOW()
FROM clients c
WHERE p.client_id = c.id
  AND p.client IS DISTINCT FROM c.name;
