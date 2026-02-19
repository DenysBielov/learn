export function sanitizeMarkdownImageUrls(markdown: string): string {
  // Match ![alt](url) patterns and remove those with non-allowlisted URLs
  // Capture URL up to first whitespace to ignore optional title attribute
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s[^)]*)?\)/g, (match, _alt, url) => {
    const trimmedUrl = (url as string).trim();
    if (trimmedUrl.startsWith("/api/images/")) return match;
    return ""; // Strip the entire image reference
  });
}
