"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AnnotationEditor } from "./AnnotationEditor";
import { FeedbackForm } from "./FeedbackForm";
import type { FeedbackCategory, FeedbackMetadata, FeedbackPriority, FeedbackLabel, Region, ConsoleEntry, NetworkEntry } from "./types";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  croppedImage: string;
  region: Region;
  diagnostics?: {
    consoleLogs: ConsoleEntry[];
    networkErrors: NetworkEntry[];
  };
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  let browser = "Unknown";

  if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("Chrome")) {
    browser = "Chrome";
  } else if (ua.includes("Safari")) {
    browser = "Safari";
  } else if (ua.includes("Edge")) {
    browser = "Edge";
  }

  const match = ua.match(new RegExp(`${browser}\\/([\\d.]+)`));
  const version = match ? match[1].split(".")[0] : "";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS")) os = "iOS";

  return `${browser} ${version} on ${os}`;
}

export function FeedbackModal({ isOpen, onClose, croppedImage, region, diagnostics }: FeedbackModalProps) {
  const [annotatedImage, setAnnotatedImage] = useState(croppedImage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasScreenshot = !!croppedImage;

  const metadata: FeedbackMetadata = {
    url: typeof window !== "undefined" ? window.location.href : "",
    browser: typeof navigator !== "undefined" ? getBrowserInfo() : "Unknown",
    viewport: typeof window !== "undefined" ? `${window.innerWidth} × ${window.innerHeight}` : "Unknown",
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    consoleLogs: diagnostics?.consoleLogs,
    networkErrors: diagnostics?.networkErrors,
  };

  const handleAnnotatedImage = useCallback((dataUrl: string) => {
    setAnnotatedImage(dataUrl);
  }, []);

  const handleSubmit = async (
    category: FeedbackCategory,
    title: string,
    description: string,
    options?: { priority?: FeedbackPriority; requiresPlanning?: boolean; labels?: FeedbackLabel[] }
  ) => {
    setIsSubmitting(true);

    const submissionMetadata = {
      ...metadata,
      consoleLogs: category === "bug" ? metadata.consoleLogs : undefined,
      networkErrors: category === "bug" ? metadata.networkErrors : undefined,
    };

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          description,
          screenshot: hasScreenshot ? annotatedImage : undefined,
          metadata: submissionMetadata,
          reporter: { name: "User", email: "user@flashcards.app" },
          priority: options?.priority,
          requiresPlanning: options?.requiresPlanning,
          labels: options?.labels,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.issueUrl) {
          toast.success(
            <div className="flex flex-col gap-1">
              <p>Feedback submitted!</p>
              <a
                href={result.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View issue →
              </a>
            </div>
          );
        } else {
          toast.success("Feedback submitted!");
        }
        onClose();
      } else {
        toast.error(result.error || "Failed to submit feedback. Please try again.");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUrlPath = () => {
    try {
      return new URL(metadata.url).pathname;
    } catch {
      return metadata.url;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={hasScreenshot ? "sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" : "sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden"}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Report Feedback</DialogTitle>
        </DialogHeader>

        <FeedbackForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          metadata={{
            url: getUrlPath(),
            browser: metadata.browser,
            viewport: metadata.viewport,
          }}
        >
          {hasScreenshot && (
            <AnnotationEditor
              imageDataUrl={croppedImage}
              onAnnotatedImage={handleAnnotatedImage}
            />
          )}
        </FeedbackForm>
      </DialogContent>
    </Dialog>
  );
}
