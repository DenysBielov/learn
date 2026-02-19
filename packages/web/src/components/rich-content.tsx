import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface RichContentProps {
  content: string;
  className?: string;
}

export function RichContent({ content, className }: RichContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => {
          if (url.startsWith("/api/images/")) return url;
          return "";
        }}
        components={{
          p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
          img: ({ src, alt }) => {
            if (!src || typeof src !== "string" || !src.startsWith("/api/images/")) return null;
            return (
              <img
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                className="max-w-full rounded-md my-2"
              />
            );
          },
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${codeClassName} block bg-muted rounded-md p-3 text-sm overflow-x-auto my-2`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-muted rounded px-1.5 py-0.5 text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-border text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => <th className="border border-border px-3 py-1.5 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <div className="text-lg font-bold mt-3 mb-1">{children}</div>,
          h2: ({ children }) => <div className="text-base font-bold mt-2 mb-1">{children}</div>,
          h3: ({ children }) => <div className="text-sm font-bold mt-2 mb-1">{children}</div>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
