"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  StickyNote,
  PanelRightClose,
} from "lucide-react";
import { SessionChat } from "./session-chat";
import { SessionNotes } from "./session-notes";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "session-panel-collapsed";
const SIDEBAR_WIDTH = 320;

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

interface SessionPanelProps {
  sessionId: number;
  currentFlashcardId?: number;
  currentQuestionId?: number;
  currentUserAnswer?: string;
  initialNotes?: string;
}

export function SessionPanel({
  sessionId,
  currentFlashcardId,
  currentQuestionId,
  currentUserAnswer,
  initialNotes,
}: SessionPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "notes">("chat");
  const [hasUnread, setHasUnread] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unreadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isMobile = useIsMobile();

  // Ref to track collapsed state for the stable handleNewMessage callback
  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  // Hydrate collapsed state from localStorage after mount
  useEffect(() => {
    setCollapsed(getInitialCollapsed());
  }, []);

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const expand = useCallback((tab?: "chat" | "notes") => {
    if (tab) setActiveTab(tab);
    setCollapsed(false);
    // Clear unread badge after a delay so user has time to see the content
    if (tab === "chat" || !tab) {
      unreadTimerRef.current = setTimeout(() => {
        setHasUnread(false);
      }, 1500);
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (unreadTimerRef.current) clearTimeout(unreadTimerRef.current);
    };
  }, []);

  // Stable callback that reads collapsed via ref — safe to pass as prop.
  // Only sets unread if sidebar is collapsed (avoids setting badge when chat is already visible).
  const handleNewMessage = useCallback(() => {
    if (collapsedRef.current) setHasUnread(true);
  }, []);

  const chatContent = (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "chat" | "notes")}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="border-b px-4">
        <TabsList className="w-full">
          <TabsTrigger value="chat" className="flex-1 cursor-pointer">
            Chat
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 cursor-pointer">
            Notes
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="chat" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <SessionChat
          sessionId={sessionId}
          currentFlashcardId={currentFlashcardId}
          currentQuestionId={currentQuestionId}
          currentUserAnswer={currentUserAnswer}
          onNewMessage={handleNewMessage}
        />
      </TabsContent>

      <TabsContent value="notes" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <SessionNotes sessionId={sessionId} initialNotes={initialNotes} />
      </TabsContent>
    </Tabs>
  );

  return (
    <>
      {/* Desktop sidebar — outer wrapper transitions width, inner aside transitions transform */}
      <div
        className="hidden md:block flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
        style={{ width: collapsed ? 48 : SIDEBAR_WIDTH }}
      >
        <aside
          className="flex h-full flex-col border-l bg-background"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {collapsed ? (
            /* Collapsed rail — 48px visible portion of the aside */
            <div className="flex flex-col items-center gap-2 py-3" style={{ width: 48 }}>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 cursor-pointer"
                onClick={() => expand("chat")}
                title="Open chat"
              >
                <MessageCircle className="h-4 w-4" />
                {hasUnread && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 cursor-pointer"
                onClick={() => expand("notes")}
                title="Open notes"
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Expanded sidebar */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-medium">AI Chat & Notes</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => setCollapsed(true)}
                  title="Collapse panel"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
              {!isMobile && chatContent}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile: FAB trigger + vaul Drawer bottom sheet */}
      {/* FAB at bottom-20 (80px) clears the 64px mobile nav bar */}
      {/* Hidden when drawer is open */}
      {!mobileOpen && (
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg cursor-pointer md:hidden"
          onClick={() => setMobileOpen(true)}
          title="AI Chat & Notes"
        >
          <MessageCircle className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-destructive" />
          )}
        </Button>
      )}

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} snapPoints={[0.5, 0.95]} fadeFromIndex={0}>
        <DrawerContent className="flex flex-col p-0">
          {isMobile && mobileOpen && chatContent}
        </DrawerContent>
      </Drawer>
    </>
  );
}
