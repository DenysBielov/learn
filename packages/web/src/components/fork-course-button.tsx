"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2 } from "lucide-react";
import { forkCourseAction } from "@/app/actions/courses";

export function ForkCourseButton({ publicId }: { publicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFork() {
    setError(null);
    startTransition(async () => {
      try {
        await forkCourseAction(publicId);
      } catch (e: any) {
        setError(e?.message ?? "Failed to fork course");
      }
    });
  }

  return (
    <div>
      <Button onClick={handleFork} disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GitBranch className="mr-2 h-4 w-4" />
        )}
        {isPending ? "Forking..." : "Fork to my library"}
      </Button>
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
