-- Commercial finance ledger metadata and an optional time-of-day schedule for tasks.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(7,2) NOT NULL DEFAULT 0;

ALTER TABLE project_payments
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'invoice'
    CHECK (entry_type IN ('invoice','addition','credit'));

CREATE INDEX IF NOT EXISTS project_payments_type_idx
  ON project_payments(project_id, entry_type, status);
