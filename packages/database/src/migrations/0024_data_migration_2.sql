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
