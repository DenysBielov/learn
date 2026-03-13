"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/rich-content";
import { StudyStartModal, startActivityAndNavigate } from "@/components/study-start-modal";
import { useActiveSession } from "@/components/active-session-provider";
import { BookOpen, ArrowLeft, ExternalLink } from "lucide-react";

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
  const searchParams = useSearchParams();
  const { session, refresh } = useActiveSession();
  const startStudying = searchParams.get("studying") === "true";
  const [isStudying, setIsStudying] = useState(startStudying || !!session);
  const [modalOpen, setModalOpen] = useState(false);

  // No description → show content immediately (backward compat)
  const hasDescription = !!description;
  const showContent = !hasDescription || isStudying;

  // For external URL only materials
  const isExternalOnly = !content && !!externalUrl;

  async function handleStudyClick() {
    if (isExternalOnly) {
      window.open(externalUrl!, "_blank");
      return;
    }
    if (session) {
      await startActivityAndNavigate(session.id, "reading", { materialId }, refresh);
      setIsStudying(true);
    } else {
      setModalOpen(true);
    }
  }

  return (
    <>
      {/* Description / fallback excerpt */}
      {hasDescription && !isStudying && (
        <div className="space-y-4">
          <p className="text-muted-foreground">{description}</p>
          <Button onClick={handleStudyClick}>
            <BookOpen className="mr-2 h-4 w-4" />
            {isExternalOnly ? "Open Material" : "Study Material"}
          </Button>
        </div>
      )}

      {/* Content */}
      {showContent && content && (
        <div className="space-y-4">
          {hasDescription && (
            <Button variant="ghost" size="sm" onClick={() => setIsStudying(false)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Button>
          )}
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <RichContent content={content} />
          </div>
        </div>
      )}

      {/* No content at all */}
      {showContent && !content && !externalUrl && (
        <p className="text-muted-foreground text-sm">No content available</p>
      )}

      {/* External URL when no content */}
      {showContent && !content && externalUrl && (
        <div className="space-y-4">
          <Button asChild>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open External Resource
            </a>
          </Button>
        </div>
      )}

      <StudyStartModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        studyUrl={`/materials/${materialId}`}
        activityType="reading"
        sourceId={{ materialId }}
        courseId={courseId}
        onStudyStart={() => setIsStudying(true)}
      />
    </>
  );
}
