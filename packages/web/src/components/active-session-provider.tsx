"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getActiveSession, getActiveActivity, createSession, completeStudySession, discardSession, startActivity, completeActivity } from "@/app/actions/flashcards";

type Session = {
  id: number;
  courseId: number | null;
  title: string | null;
  startedAt: Date;
};

type Activity = {
  id: number;
  type: "flashcard_review" | "quiz_answer" | "reading";
  deckId: number | null;
  quizId: number | null;
  materialId: number | null;
  startedAt: Date;
};

type ActiveSessionContextType = {
  session: Session | null;
  currentActivity: Activity | null;
  isLoading: boolean;
  startSession: (courseId?: number, title?: string) => Promise<Session>;
  endSession: () => Promise<void>;
  discard: () => Promise<void>;
  beginActivity: (type: Activity["type"], opts: { deckId?: number; quizId?: number; materialId?: number }) => Promise<Activity>;
  endActivity: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ActiveSessionContext = createContext<ActiveSessionContextType | null>(null);

export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) throw new Error("useActiveSession must be used within ActiveSessionProvider");
  return ctx;
}

interface ActiveSessionProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
}

export function ActiveSessionProvider({ children, initialSession }: ActiveSessionProviderProps) {
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSession);

  const refresh = useCallback(async () => {
    const active = await getActiveSession();
    setSession(active);
    if (active) {
      const activity = await getActiveActivity(active.id);
      setCurrentActivity(activity);
    } else {
      setCurrentActivity(null);
    }
    setIsLoading(false);
  }, []);

  const initialSessionId = initialSession?.id ?? null;

  useEffect(() => {
    if (initialSessionId) {
      // Still need to fetch the active activity for the initial session
      getActiveActivity(initialSessionId).then(setCurrentActivity);
    } else {
      refresh();
    }
  }, [refresh, initialSessionId]);

  // Re-fetch active session when tab regains focus (cross-tab sync)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

  const startSessionFn = useCallback(async (courseId?: number, title?: string) => {
    const s = await createSession(courseId, title);
    setSession(s);
    return s;
  }, []);

  const endSessionFn = useCallback(async () => {
    if (!session) return;
    await completeStudySession(session.id);
    setSession(null);
    setCurrentActivity(null);
  }, [session]);

  const discardFn = useCallback(async () => {
    if (!session) return;
    await discardSession(session.id);
    setSession(null);
    setCurrentActivity(null);
  }, [session]);

  const beginActivityFn = useCallback(async (
    type: Activity["type"],
    opts: { deckId?: number; quizId?: number; materialId?: number }
  ) => {
    if (!session) throw new Error("No active session");
    // startActivity auto-completes any open activity server-side
    const a = await startActivity(session.id, type, opts);
    setCurrentActivity(a);
    return a;
  }, [session]);

  const endActivityFn = useCallback(async () => {
    if (!currentActivity) return;
    await completeActivity(currentActivity.id);
    setCurrentActivity(null);
  }, [currentActivity]);

  return (
    <ActiveSessionContext.Provider value={{
      session,
      currentActivity,
      isLoading,
      startSession: startSessionFn,
      endSession: endSessionFn,
      discard: discardFn,
      beginActivity: beginActivityFn,
      endActivity: endActivityFn,
      refresh,
    }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}
