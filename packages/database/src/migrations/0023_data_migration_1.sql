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
