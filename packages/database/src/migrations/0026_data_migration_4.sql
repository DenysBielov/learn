-- Set name from email prefix for existing users
UPDATE users SET name = substr(email, 1, instr(email, '@') - 1) WHERE name IS NULL;
