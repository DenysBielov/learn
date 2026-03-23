-- Migrate existing passwords to account table
INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  CAST(id AS TEXT),
  'credential',
  password_hash,
  COALESCE(created_at, unixepoch()),
  unixepoch()
FROM users
WHERE password_hash IS NOT NULL;

-- Migrate existing MCP tokens to api_tokens table
INSERT INTO api_tokens (user_id, type, name, token_hash, created_at)
SELECT
  id,
  'mcp',
  'Migrated MCP Token',
  mcp_token_hash,
  COALESCE(created_at, unixepoch())
FROM users
WHERE mcp_token_hash IS NOT NULL;

-- Set emailVerified = true for existing users (trusted, CLI-created)
UPDATE users SET email_verified = 1 WHERE email_verified = 0;

-- Set name from email prefix for existing users
UPDATE users SET name = substr(email, 1, instr(email, '@') - 1) WHERE name IS NULL;

-- Generate publicId for existing courses
UPDATE course SET public_id = lower(hex(randomblob(16))) WHERE public_id IS NULL OR public_id = '';

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
