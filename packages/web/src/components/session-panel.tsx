"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageCircle, GraduationCap, Lightbulb } from "lucide-react";
import { SessionChat } from "./session-chat";
import { SessionNotes } from "./session-notes";

interface SessionPanelProps {
  sessionId: number;
  currentFlashcardId?: number;
  currentQuestionId?: number;
  currentUserAnswer?: string;
}

export function SessionPanel({
  sessionId,
  currentFlashcardId,
  currentQuestionId,
  currentUserAnswer,
}: SessionPanelProps) {
  const [open, setOpen] = useState(false);
  // chatMode is per-message — switching modes mid-conversation is intentional.
  // The mode applies to the next message sent; the AI handles context switches naturally.
  const [chatMode, setChatMode] = useState<"explain" | "educate">("explain");

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
        title="AI Chat & Notes"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-base">AI Chat & Notes</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="chat" className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b px-4">
              <TabsList className="w-full">
                <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="mt-0 flex flex-1 flex-col overflow-hidden">
              {/* Mode toggle */}
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <button
                  type="button"
                  onClick={() => setChatMode("explain")}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    chatMode === "explain"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Lightbulb className="h-3 w-3" />
                  Explain
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode("educate")}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    chatMode === "educate"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <GraduationCap className="h-3 w-3" />
                  Educate
                </button>
              </div>

              <SessionChat
                sessionId={sessionId}
                currentFlashcardId={currentFlashcardId}
                currentQuestionId={currentQuestionId}
                currentUserAnswer={currentUserAnswer}
                chatMode={chatMode}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-0 flex flex-1 flex-col overflow-hidden">
              <SessionNotes sessionId={sessionId} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
