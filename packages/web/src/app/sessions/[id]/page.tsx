import { getSession } from "@/app/actions/sessions";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Clock, Layers, HelpCircle, CheckCircle2,
  XCircle, FileText, Target
} from "lucide-react";

export const metadata = {
  title: "Session Detail — Flashcards",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(Number(id));
  if (!session) notFound();

  const isActive = !session.completedAt;
  const duration = session.completedAt
    ? Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : null;
  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const totalCards = session.cardReviews.length;
  const correctCards = session.cardReviews.filter(r => r.correct).length;
  const cardAccuracy = totalCards > 0 ? Math.round((correctCards / totalCards) * 100) : null;

  const totalQuestions = session.quizAnswers.length;
  const correctQuestions = session.quizAnswers.filter(r => r.correct).length;
  const quizAccuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : null;

  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Back link */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Sessions
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold mb-2">
          {session.summary || session.deckName || "Study Session"}
        </h1>
        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
          <span>{dateStr} at {timeStr}</span>
          {duration !== null && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {duration}m
              </span>
            </>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${
            isActive
              ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
              : "text-green-400 bg-green-500/10 border-green-500/20"
          }`}>
            {isActive ? "Active" : "Completed"}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border rounded-[10px] p-3 text-center">
              <div className="text-lg font-bold">{totalCards}</div>
              <div className="text-xs text-muted-foreground">Cards Reviewed</div>
            </div>
            <div className="bg-card border rounded-[10px] p-3 text-center">
              <div className="text-lg font-bold">{totalQuestions}</div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="bg-card border rounded-[10px] p-3 text-center">
              <div className={`text-lg font-bold ${cardAccuracy !== null && cardAccuracy >= 80 ? "text-green-400" : ""}`}>
                {cardAccuracy !== null ? `${cardAccuracy}%` : "\u2014"}
              </div>
              <div className="text-xs text-muted-foreground">Card Accuracy</div>
            </div>
            <div className="bg-card border rounded-[10px] p-3 text-center">
              <div className={`text-lg font-bold ${quizAccuracy !== null && quizAccuracy >= 80 ? "text-green-400" : ""}`}>
                {quizAccuracy !== null ? `${quizAccuracy}%` : "\u2014"}
              </div>
              <div className="text-xs text-muted-foreground">Quiz Accuracy</div>
            </div>
          </div>

          {/* Activity breakdown */}
          {(totalCards > 0 || totalQuestions > 0) && (
            <div className="bg-card border rounded-[10px] p-4">
              <h2 className="text-sm font-semibold mb-3">Activity</h2>
              <div className="space-y-2">
                {totalCards > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span>Flashcard Reviews</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle2 className="h-3 w-3" />{correctCards}
                      </span>
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                        <XCircle className="h-3 w-3" />{totalCards - correctCards}
                      </span>
                    </div>
                  </div>
                )}
                {totalQuestions > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Quiz Questions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle2 className="h-3 w-3" />{correctQuestions}
                      </span>
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                        <XCircle className="h-3 w-3" />{totalQuestions - correctQuestions}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {session.notes && (
            <div className="bg-card border rounded-[10px] p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notes
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}

          {/* Summary/Insight */}
          {session.summary && (
            <div className="bg-card border rounded-[10px] p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Session Summary
              </h2>
              <p className="text-sm text-muted-foreground italic border-l-2 border-muted-foreground/20 pl-3">
                {session.summary}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Session Info */}
          <div className="bg-card border rounded-[10px] p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Session Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="capitalize">{session.mode}</span>
              </div>
              {session.courseName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Course</span>
                  <Link href={`/courses/${session.courseId}`} className="text-blue-400 hover:underline truncate ml-2">
                    {session.courseName}
                  </Link>
                </div>
              )}
              {session.deckName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deck</span>
                  <Link href={`/decks/${session.deckId}`} className="text-blue-400 hover:underline truncate ml-2">
                    {session.deckName}
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(session.startedAt).toLocaleDateString()}</span>
              </div>
              {duration !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{duration}m</span>
                </div>
              )}
            </div>
          </div>

          {/* Related Sessions */}
          {session.relatedSessions.length > 0 && (
            <div className="bg-card border rounded-[10px] p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Related Sessions</h3>
              <div className="space-y-2">
                {session.relatedSessions.map((related) => (
                  <Link
                    key={related.id}
                    href={`/sessions/${related.id}`}
                    className="block p-2 rounded-lg border transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]"
                  >
                    <div className="text-sm font-medium truncate">
                      {related.summary || "Study Session"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(related.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" · "}
                      <span className="capitalize">{related.mode}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
