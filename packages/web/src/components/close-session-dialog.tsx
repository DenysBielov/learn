"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { completeStudySession } from "@/app/actions/flashcards";

interface CloseSessionDialogProps {
  sessionId: number;
  startedAt: Date | string;
  trigger: React.ReactNode;
}

export function CloseSessionDialog({
  sessionId,
  startedAt,
  trigger,
}: CloseSessionDialogProps) {
  const parsedStartedAt = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getCompletedAt(): Date | null {
    if (!date) return null;
    const [hours, minutes] = time.split(":").map(Number);
    const completedAt = new Date(date);
    completedAt.setHours(hours, minutes, 0, 0);
    return completedAt;
  }

  function validate(): string | null {
    const completedAt = getCompletedAt();
    if (!completedAt) return "Please select a date";
    if (completedAt <= parsedStartedAt) {
      return `Completed time must be after session start (${format(parsedStartedAt, "PPp")})`;
    }
    if (completedAt > new Date()) {
      return "Completed time must not be in the future";
    }
    return null;
  }

  function setToNow() {
    const now = new Date();
    setDate(now);
    setTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    );
    setError(null);
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const completedAt = getCompletedAt()!;
      await completeStudySession(sessionId, completedAt);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close session");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setToNow();
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Session</DialogTitle>
          <DialogDescription>
            Set the completion time for this session. Defaults to now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setError(null);
                  }}
                  disabled={(d) =>
                    d > new Date() || d < new Date(parsedStartedAt.getTime() - 86400000)
                  }
                  defaultMonth={date}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="close-session-time">Time</Label>
            <Input
              id="close-session-time"
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={setToNow}
            disabled={isLoading}
          >
            Set to now
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Closing..." : "Close Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
