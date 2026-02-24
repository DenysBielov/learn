import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface RichContentProps {
  content: string;
  className?: string;
}

function stripClozeMarkers(text: string): string {
  return text.replace(/\{\{c\d+::([^}]*?)(?:::[^}]*)?\}\}/g, '$1');
}

const remarkPlugins = [remarkMath, remarkGfm];
const rehypePlugins = [rehypeKatex];

export function urlTransform(url: string) {
  if (url.startsWith("/api/images/")) return url;
  return "";
}

export const richContentComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <span className="block mb-2 last:mb-0">{children}</span>,
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => {
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
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ className: codeClassName, children, ...props }: { className?: string; children?: React.ReactNode }) => {
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
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="my-2">{children}</pre>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-border text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="border border-border px-3 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="border border-border px-3 py-1.5">{children}</td>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => <div className="text-lg font-bold mt-3 mb-1">{children}</div>,
  h2: ({ children }: { children?: React.ReactNode }) => <div className="text-base font-bold mt-2 mb-1">{children}</div>,
  h3: ({ children }: { children?: React.ReactNode }) => <div className="text-sm font-bold mt-2 mb-1">{children}</div>,
};

export const RichContent = memo(function RichContent({ content, className }: RichContentProps) {
  const processed = stripClozeMarkers(content);
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        urlTransform={urlTransform}
        components={richContentComponents}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});
