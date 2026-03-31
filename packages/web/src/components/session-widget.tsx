"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Brain, Check, FileText, GripHorizontal, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveSession } from "@/components/active-session-provider";
import { DiscardSessionDialog } from "@/components/discard-session-dialog";
import { StepCompleteButton } from "@/components/step-complete-button";
import { getSessionFeedData, type FeedActivity, type JourneyStep } from "@/app/actions/sessions";
import { parseStudyRoute } from "@/lib/route-utils";

// ---------------------------------------------------------------------------
// Drag hook — allows dragging the widget around the viewport, clamped to edges
// ---------------------------------------------------------------------------
function useDraggable(initialPos: { x: number; y: number }) {
  const [position, setPosition] = useState(initialPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback((x: number, y: number) => {
    const el = elementRef.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 44;
    return {
      x: Math.max(0, Math.min(window.innerWidth - w, x)),
      y: Math.max(0, Math.min(window.innerHeight - h, y)),
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    setIsDragging(false);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!isDragging && Math.abs(dx) + Math.abs(dy) > 4) {
      setIsDragging(true);
    }
    setPosition(clamp(dragStart.current.posX + dx, dragStart.current.posY + dy));
  }, [isDragging, clamp]);

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
    setTimeout(() => setIsDragging(false), 0);
  }, []);

  // Re-clamp when element size changes (e.g. collapsed ↔ expanded)
  const reclamp = useCallback(() => {
    setPosition((prev) => clamp(prev.x, prev.y));
  }, [clamp]);

  return { position, isDragging, elementRef, handlePointerDown, handlePointerMove, handlePointerUp, reclamp };
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type FeedItem = {
  id: string;
  type: "reading" | "quiz_answer" | "flashcard_review";
  title: string;
  meta: string;
  progress: number;
  isCompleted: boolean;
  isCurrentPage: boolean;
  materialId: number | null;
  quizId: number | null;
  deckId: number | null;
  stepId: number | null; // course step id for complete button
  group: "completed" | "in_progress" | "up_next";
};

function typeIcon(type: FeedItem["type"]) {
  switch (type) {
    case "reading": return <FileText className="h-3.5 w-3.5 text-blue-500" />;
    case "quiz_answer": return <Brain className="h-3.5 w-3.5 text-orange-500" />;
    case "flashcard_review": return <BookOpen className="h-3.5 w-3.5 text-indigo-500" />;
  }
}

function typeIconBg(type: FeedItem["type"]) {
  switch (type) {
    case "reading": return "bg-blue-500/10 border-blue-500/20";
    case "quiz_answer": return "bg-orange-500/10 border-orange-500/20";
    case "flashcard_review": return "bg-indigo-500/10 border-indigo-500/20";
  }
}

function typeFillColor(type: FeedItem["type"]) {
  switch (type) {
    case "reading": return "bg-blue-500";
    case "quiz_answer": return "bg-orange-500";
    case "flashcard_review": return "bg-indigo-500";
  }
}

function typeLabel(type: FeedItem["type"]) {
  switch (type) {
    case "reading": return "Reading";
    case "quiz_answer": return "Quiz";
    case "flashcard_review": return "Flashcards";
  }
}

function activityToFeedItem(
  a: FeedActivity,
  currentRoute: ReturnType<typeof parseStudyRoute>,
): FeedItem {
  const isCurrentPage = !!(
    (a.materialId && currentRoute?.materialId === a.materialId) ||
    (a.quizId && currentRoute?.quizId === a.quizId) ||
    (a.deckId && currentRoute?.deckId === a.deckId)
  );
  return {
    id: `activity:${a.id}`,
    type: a.type,
    title: a.title ?? "(Deleted)",
    meta: typeLabel(a.type),
    progress: a.progress,
    isCompleted: !!a.completedAt,
    isCurrentPage,
    materialId: a.materialId,
    quizId: a.quizId,
    deckId: a.deckId,
    stepId: null,
    group: a.completedAt ? "completed" : "in_progress",
  };
}

export function SessionWidget() {
  const { session, currentActivity, endSession, refresh } = useActiveSession();
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [feedData, setFeedData] = useState<{ activities: FeedActivity[]; journey: JourneyStep[] | null } | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  // Default position: above the feedback button (bottom-6 = 24px, button ~44px, gap 8px)
  const [defaultPos] = useState(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    return { x: window.innerWidth - 340, y: window.innerHeight - 76 - 44 };
  });
  const { position, isDragging, elementRef, handlePointerDown, handlePointerMove, handlePointerUp, reclamp } = useDraggable(defaultPos);

  // Timer
  useEffect(() => {
    if (!session) return;
    const startTime = new Date(session.startedAt).getTime();
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Fetch feed data when panel opens or activity changes while open
  const fetchFeed = useCallback(async () => {
    if (!session) return;
    try {
      const data = await getSessionFeedData(session.id);
      setFeedData(data);
    } catch {
      // ignore
    }
  }, [session]);

  useEffect(() => {
    if (isOpen) fetchFeed();
  }, [isOpen, fetchFeed]);

  // Re-fetch when activity changes (e.g. quiz completed), but not on initial mount
  const prevActivityRef = useRef(currentActivity);
  useEffect(() => {
    if (prevActivityRef.current !== currentActivity && prevActivityRef.current !== undefined) {
      fetchFeed();
    }
    prevActivityRef.current = currentActivity;
  }, [fetchFeed, currentActivity]);

  // Listen for step completion changes from page
  useEffect(() => {
    const handler = () => fetchFeed();
    window.addEventListener("step-complete-changed", handler);
    return () => window.removeEventListener("step-complete-changed", handler);
  }, [fetchFeed]);

  // Click-outside dismiss — ignore clicks inside dialogs/overlays
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (elementRef.current && !elementRef.current.contains(target) && !target.closest("[role='alertdialog'], [role='dialog'], [data-radix-portal]")) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, elementRef]);

  // Re-clamp position when toggling between collapsed/expanded
  useEffect(() => {
    // Wait a frame for the DOM to update with new dimensions
    requestAnimationFrame(reclamp);
  }, [isOpen, reclamp]);

  async function handleEnd() {
    setIsEnding(true);
    try {
      await endSession();
    } finally {
      setIsEnding(false);
    }
  }

  function handleStepChange() {
    fetchFeed();
    router.refresh();
  }

  if (!session) return null;

  // Current page detection
  const currentRoute = parseStudyRoute(pathname);

  // Build feed items
  const feedItems: FeedItem[] = [];
  if (feedData) {
    const { activities, journey } = feedData;

    if (journey) {
      // Course session: merge journey + activities
      const activityByStep = new Map<string, FeedActivity>();
      for (const a of activities) {
        if (a.materialId) activityByStep.set(`material:${a.materialId}`, a);
        if (a.quizId) activityByStep.set(`quiz:${a.quizId}`, a);
        if (a.deckId && a.type === "flashcard_review") activityByStep.set(`deck:${a.deckId}`, a);
      }

      for (const step of journey) {
        const key = step.materialId ? `material:${step.materialId}` : step.quizId ? `quiz:${step.quizId}` : null;
        const activity = key ? activityByStep.get(key) : null;

        const isCurrentPage = !!(
          (step.materialId && currentRoute?.materialId === step.materialId) ||
          (step.quizId && currentRoute?.quizId === step.quizId)
        );

        const activityDone = !!activity?.completedAt;
        const isCompleted = step.isCompleted || activityDone;
        const hasActivity = !!activity;
        const progress = activity?.progress ?? 0;

        let group: FeedItem["group"] = "up_next";
        if (isCompleted) group = "completed";
        else if (hasActivity) group = "in_progress";

        const type: FeedItem["type"] = step.stepType === "material" ? "reading" : "quiz_answer";

        feedItems.push({
          id: `step:${step.id}`,
          type,
          title: step.title,
          meta: `${typeLabel(type)} · Step ${step.position + 1}`,
          progress: isCompleted ? 100 : progress,
          isCompleted,
          isCurrentPage,
          materialId: step.materialId,
          quizId: step.quizId,
          deckId: null,
          stepId: step.id,
          group,
        });
      }

      // Also add activities not tied to journey steps (e.g. deck reviews)
      const journeyMaterialIds = new Set(journey.filter(s => s.materialId).map(s => s.materialId));
      const journeyQuizIds = new Set(journey.filter(s => s.quizId).map(s => s.quizId));
      for (const a of activities) {
        if (a.materialId && journeyMaterialIds.has(a.materialId)) continue;
        if (a.quizId && journeyQuizIds.has(a.quizId)) continue;
        feedItems.push(activityToFeedItem(a, currentRoute));
      }
    } else {
      // Non-course session: just activities
      for (const a of activities) {
        feedItems.push(activityToFeedItem(a, currentRoute));
      }
    }
  }

  const completedItems = feedItems.filter(i => i.group === "completed");
  const inProgressItems = feedItems.filter(i => i.group === "in_progress");
  const upNextItems = feedItems.filter(i => i.group === "up_next");

  const totalSteps = feedData?.journey?.length ?? feedItems.length;
  const completedCount = completedItems.length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // Current step title for collapsed bar
  const currentItem = feedItems.find(i => i.isCurrentPage) ?? inProgressItems[0] ?? null;
  const barTitle = currentItem?.title ?? session.title ?? "Study Session";

  // Inline complete button: on current page's incomplete journey step
  const currentPageStep = feedItems.find(i => i.isCurrentPage && i.stepId && !i.isCompleted);

  // Expanded panel — draggable by header
  if (isOpen) {
    return (
      <div
        ref={elementRef}
        className="fixed z-50 flex flex-col max-w-[340px] w-[calc(100vw-2rem)] max-h-[60dvh] bg-card border rounded-xl shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        {/* Header — drag handle */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 select-none touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <h3 className="text-sm font-semibold truncate">
              {session.title || "Study Session"}
            </h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Timer + Stats */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <span className="text-2xl font-mono font-bold tabular-nums">
            {formatElapsed(elapsed)}
          </span>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {completedItems.length > 0 && (
              <span>{completedCount}/{totalSteps} done</span>
            )}
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {feedData === null ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : feedItems.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No activities yet</div>
          ) : (
            <>
              {completedItems.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Completed
                  </div>
                  {completedItems.map(item => (
                    <FeedItemRow key={item.id} item={item} onStepChange={handleStepChange} />
                  ))}
                </>
              )}
              {inProgressItems.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    In Progress
                  </div>
                  {inProgressItems.map(item => (
                    <FeedItemRow key={item.id} item={item} onStepChange={handleStepChange} />
                  ))}
                </>
              )}
              {upNextItems.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Up Next
                  </div>
                  {upNextItems.map(item => (
                    <FeedItemRow key={item.id} item={item} onStepChange={handleStepChange} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t flex-shrink-0">
          <Button size="sm" onClick={handleEnd} disabled={isEnding} className="flex-1">
            {isEnding ? "Ending..." : "End Session"}
          </Button>
          <DiscardSessionDialog
            sessionId={session.id}
            onDiscarded={() => refresh()}
            trigger={
              <Button size="sm" variant="outline" className="text-destructive">
                Discard
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // Collapsed bar — draggable
  return (
    <div
      ref={elementRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => { if (!isDragging) setIsOpen(!isOpen); }}
      className={`fixed z-50 flex items-center gap-2 bg-card border rounded-xl px-3 shadow-lg hover:shadow-xl transition-shadow max-w-[calc(100vw-2rem)] min-h-[44px] overflow-hidden group cursor-grab select-none touch-none ${isDragging ? "cursor-grabbing shadow-xl" : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      {/* Drag handle */}
      <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />

      {/* Progress line */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width] duration-500"
        style={{ width: `${progressPct}%` }}
      />

      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />

      <span className="flex items-center gap-1 text-sm font-medium tabular-nums flex-shrink-0 min-w-0">
        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
        {formatElapsed(elapsed)}
      </span>

      <span className="w-px h-4 bg-border flex-shrink-0" />

      <span className={`text-xs text-muted-foreground truncate min-w-0 max-w-[80px] sm:max-w-[120px] md:max-w-[200px] ${currentPageStep ? "hidden sm:inline" : ""}`}>
        {barTitle}
      </span>

      {totalSteps > 0 && (
        <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
          {completedCount}/{totalSteps}
        </span>
      )}

      {currentPageStep && (
        <span
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <StepCompleteButton
            stepId={currentPageStep.stepId!}
            isCompleted={false}
            onChange={handleStepChange}
            variant="icon"
          />
        </span>
      )}
    </div>
  );
}

function FeedItemRow({ item, onStepChange }: { item: FeedItem; onStepChange: () => void }) {
  const router = useRouter();
  const isUpcoming = item.group === "up_next";

  const href = item.materialId ? `/materials/${item.materialId}` : item.quizId ? `/quizzes/${item.quizId}` : item.deckId ? `/decks/${item.deckId}` : null;

  function handleClick() {
    if (href) router.push(href);
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 rounded-r-lg text-sm overflow-hidden border-l-4 ${
        item.isCurrentPage ? "border-l-primary" : "border-l-transparent"
      } ${isUpcoming && !item.isCurrentPage ? "opacity-40" : ""} ${href ? "cursor-pointer hover:bg-muted/50" : ""}`}
    >
      {/* Background fill progress */}
      {!isUpcoming && item.progress > 0 && (
        <div
          className={`absolute top-0 left-0 bottom-0 ${typeFillColor(item.type)} opacity-[0.07] rounded-l-lg pointer-events-none`}
          style={{ width: `${item.progress}%` }}
        />
      )}

      {/* Icon */}
      <div className={`relative flex items-center justify-center h-7 w-7 rounded-md border flex-shrink-0 ${typeIconBg(item.type)} ${isUpcoming ? "border-dashed" : ""}`}>
        {typeIcon(item.type)}
      </div>

      {/* Info */}
      <div className="relative flex-1 min-w-0">
        <div className="font-medium text-xs truncate">{item.title}</div>
        <div className="text-[11px] text-muted-foreground">{item.meta}</div>
      </div>

      {/* Complete button or check icon */}
      {item.isCompleted ? (
        <div className="relative flex-shrink-0">
          <Check className="h-4 w-4 text-green-500" />
        </div>
      ) : item.stepId ? (
        <div className={`relative flex-shrink-0 ${item.isCurrentPage ? "" : "invisible"}`}>
          <StepCompleteButton
            stepId={item.stepId}
            isCompleted={false}
            onChange={onStepChange}
            variant="icon"
          />
        </div>
      ) : null}
    </div>
  );
}
