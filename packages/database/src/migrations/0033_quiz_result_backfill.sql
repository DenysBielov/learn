-- Backfill answered_at for rows that existed before the column was added.
-- The previous migration (0032) gave them DEFAULT (unixepoch()) = migration time;
-- replace with the activity's completed_at (preferred) or started_at when available.
UPDATE quiz_result
SET answered_at = COALESCE(
  (SELECT sa.completed_at FROM session_activity sa WHERE sa.id = quiz_result.activity_id),
  (SELECT sa.started_at FROM session_activity sa WHERE sa.id = quiz_result.activity_id),
  answered_at
)
WHERE activity_id IS NOT NULL;
