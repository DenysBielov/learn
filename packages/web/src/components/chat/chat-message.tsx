"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

const ALLOWED_ELEMENTS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "strong", "em", "code", "pre",
  "blockquote", "a", "br", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
  // KaTeX math elements
  "span", "math", "semantics", "mrow", "mi", "mo", "mn", "ms",
  "mtext", "mfrac", "msup", "msub", "mover", "munder", "msqrt",
  "mroot", "mtable", "mtr", "mtd", "annotation",
];

function urlTransform(url: string): string | undefined {
  if (url.startsWith("https:") || url.startsWith("http:")) return url;
  if (url.startsWith("/")) return url;
  return undefined;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  sources?: Array<{ url: string; title?: string }>;
}

export function ChatMessage({ role, content, imageUrl, sources }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {imageUrl && (
          <img
            src={`/api/chat/images/${imageUrl}`}
            alt={isUser ? "Uploaded image" : "Generated image"}
            className="mb-2 max-h-48 rounded"
            loading="lazy"
          />
        )}
        {content && (
          <div className="prose prose-sm max-w-none text-inherit [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-inherit prose-strong:text-inherit prose-a:text-inherit">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              allowedElements={ALLOWED_ELEMENTS}
              urlTransform={urlTransform}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {sources && sources.length > 0 && (
          <div className="mt-2 border-t pt-1.5 text-xs text-muted-foreground">
            {sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-2 underline"
              >
                [{i + 1}] {s.title ?? "Source"}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
