ALTER TABLE client_files
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_entity_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_client_files_related_entity ON client_files(related_entity_type,related_entity_id) WHERE related_entity_type<>'';

-- Link files uploaded before entity-aware media was introduced when the
-- generated title identifies one unambiguous review or meeting in the project.
UPDATE client_files file SET related_entity_type='site_review',related_entity_id=review.id::text
FROM project_site_reviews review
WHERE file.project_id=review.project_id AND file.related_entity_type=''
  AND file.category='ביקורת אתר'
  AND file.title LIKE ('ביקורת אתר '||review.review_date::date::text||'%')
  AND 1=(SELECT COUNT(*) FROM project_site_reviews candidate WHERE candidate.project_id=file.project_id AND file.title LIKE ('ביקורת אתר '||candidate.review_date::date::text||'%'));

UPDATE client_files file SET related_entity_type='meeting_summary',related_entity_id=meeting.id::text
FROM project_meeting_summaries meeting
WHERE file.project_id=meeting.project_id AND file.related_entity_type=''
  AND file.category='סיכום פגישה'
  AND file.title LIKE ('סיכום פגישה '||meeting.meeting_at::date::text||'%')
  AND 1=(SELECT COUNT(*) FROM project_meeting_summaries candidate WHERE candidate.project_id=file.project_id AND file.title LIKE ('סיכום פגישה '||candidate.meeting_at::date::text||'%'));
