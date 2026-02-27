"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useActiveSession } from "@/components/active-session-provider";

export function StartSessionButton() {
  const router = useRouter();
  const { session, startSession } = useActiveSession();
  const [isStarting, setIsStarting] = useState(false);

  async function handleStart() {
    setIsStarting(true);
    try {
      await startSession();
      router.refresh();
    } finally {
      setIsStarting(false);
    }
  }

  if (session) {
    return (
      <Button size="sm" variant="outline" asChild>
        <a href={`/sessions/${session.id}`}>View Session</a>
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={handleStart} disabled={isStarting}>
      <Plus className="h-4 w-4 mr-1" />
      {isStarting ? "Starting..." : "Start Session"}
    </Button>
  );
}
