"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/rich-content";
import { startActivityAndNavigate } from "@/components/study-start-modal";
import { useActiveSession } from "@/components/active-session-provider";
import { BookOpen, ExternalLink } from "lucide-react";

interface MaterialContentProps {
  materialId: number;
  description: string | null;
  content: string | null;
  externalUrl: string | null;
  courseId?: number;
}

export function MaterialContent({
  materialId,
  description,
  content,
  externalUrl,
  courseId,
}: MaterialContentProps) {
  const { session, startSession, refresh } = useActiveSession();
  const [isStarting, setIsStarting] = useState(false);

  const isExternalOnly = !content && !!externalUrl;

  async function handleStartSession() {
    if (isExternalOnly) {
      window.open(externalUrl!, "_blank");
      return;
    }
    setIsStarting(true);
    try {
      const activeSession = session ?? await startSession(courseId);
      await startActivityAndNavigate(activeSession.id, "reading", { materialId }, refresh);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Start session button — only when no active session */}
      {!session && (
        <Button onClick={handleStartSession} disabled={isStarting}>
          <BookOpen className="mr-2 h-4 w-4" />
          {isStarting ? "Starting..." : isExternalOnly ? "Open Material" : "Start Study Session"}
        </Button>
      )}

      {/* Description */}
      {description && (
        <p className="text-muted-foreground">{description}</p>
      )}

      {/* Content */}
      {content && (
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <RichContent content={content} />
        </div>
      )}

      {/* No content at all */}
      {!content && !externalUrl && (
        <p className="text-muted-foreground text-sm">No content available</p>
      )}

      {/* External URL when no content */}
      {!content && externalUrl && (
        <div>
          <Button asChild>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open External Resource
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
