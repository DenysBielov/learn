-- Set emailVerified = true for existing users (trusted, CLI-created)
UPDATE users SET email_verified = 1 WHERE email_verified = 0;
