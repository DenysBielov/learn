-- Set rootCourseId for sub-courses using recursive CTE
-- This handles arbitrary nesting depth
WITH RECURSIVE course_roots AS (
  -- Base: top-level courses (parentId IS NULL) are their own roots
  SELECT id, id AS root_id FROM course WHERE parent_id IS NULL
  UNION ALL
  -- Recurse: children inherit their parent's root
  SELECT c.id, cr.root_id
  FROM course c
  JOIN course_roots cr ON c.parent_id = cr.id
)
UPDATE course SET root_course_id = (
  SELECT root_id FROM course_roots WHERE course_roots.id = course.id
) WHERE parent_id IS NOT NULL;
