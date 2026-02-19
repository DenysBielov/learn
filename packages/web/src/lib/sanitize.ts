/**
 * Sanitize text content to prevent prompt injection attacks.
 * Strips common injection patterns from user/DB content before
 * passing it to LLM prompts.
 */
export function sanitizeContent(text: string): string {
  return text
    .replace(/\[SYSTEM\]/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/?s>/gi, "");
}
