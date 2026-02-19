import { getSessionHistory } from "@/app/actions/flashcards";
import { Badge } from "@/components/ui/badge";
import { RichContent } from "@/components/rich-content";

interface SessionHistoryProps {
  deckId?: number;
  courseId?: number;
}

export async function SessionHistory({ deckId, courseId }: SessionHistoryProps) {
  const sessions = await getSessionHistory(deckId, courseId);

  if (sessions.length === 0) return null;

  // Format dates with explicit UTC timezone for consistent server rendering.
  // Acceptable for a single-user app; user locale differences are negligible.
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
      <div className="space-y-3">
        {sessions.map((session) => (
          <details key={session.id} className="group rounded-lg border">
            <summary className="flex cursor-pointer items-center gap-3 p-3 text-sm [&::-webkit-details-marker]:hidden">
              <Badge variant="outline" className="shrink-0">
                {session.mode === "flashcard" ? "Study" : "Quiz"}
              </Badge>
              <span className="text-muted-foreground">
                {formatDate(session.startedAt)} {formatTime(session.startedAt)}
              </span>
              <span className="text-muted-foreground">
                {session.itemCount} {session.mode === "flashcard" ? "cards" : "questions"}
              </span>
              {session.mode === "quiz" && session.itemCount > 0 && (
                <span className="text-muted-foreground">
                  {Math.round((session.correctCount / session.itemCount) * 100)}%
                </span>
              )}
              {session.notes && (
                <span className="ml-auto truncate text-xs text-muted-foreground max-w-[200px]">
                  {session.notes.slice(0, 100)}
                </span>
              )}
            </summary>
            {session.notes && (
              <div className="border-t px-3 py-3 text-sm">
                <RichContent content={session.notes} />
              </div>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
