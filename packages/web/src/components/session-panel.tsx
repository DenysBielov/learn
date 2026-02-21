"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
const STORAGE_KEY_WIDTH = "session-panel-width";
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const RAIL_WIDTH = 48;

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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const unreadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isMobile = useIsMobile();

  // Ref to track collapsed state for the stable handleNewMessage callback
  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  // Hydrate collapsed state and width from localStorage after mount
  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    try {
      const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
      if (stored) {
        const parsed = Number(stored);
        if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) setWidth(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  // Resize handle logic — uses refs for smooth drag without transition lag
  const widthRef = useRef(width);
  const outerRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      widthRef.current = newWidth;
      // Write directly to DOM — avoids React re-render per pixel
      if (outerRef.current) outerRef.current.style.width = `${newWidth}px`;
      if (asideRef.current) asideRef.current.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      // Sync React state & persist
      const finalWidth = widthRef.current;
      setWidth(finalWidth);
      setIsResizing(false);
      try { localStorage.setItem(STORAGE_KEY_WIDTH, String(finalWidth)); } catch { /* ignore */ }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

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
      <div className="px-4">
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
      {/* Desktop sidebar — outer wrapper transitions width (disabled during resize) */}
      <div
        ref={outerRef}
        className={`hidden md:block flex-shrink-0 overflow-hidden ${isResizing ? "" : "transition-[width] duration-200 ease-in-out"}`}
        style={{ width: collapsed ? RAIL_WIDTH : width }}
      >
        <aside
          ref={asideRef}
          className="relative flex h-full flex-col border-l bg-background"
          style={{ width }}
        >
          {/* Resize handle — 8px invisible hit area, 2px visible line on hover */}
          {!collapsed && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize group"
            >
              <div className="absolute inset-y-0 left-0 w-0.5 group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors" />
            </div>
          )}
          {collapsed ? (
            /* Collapsed rail — 48px visible portion of the aside */
            <div className="flex flex-col items-center gap-2 py-3" style={{ width: RAIL_WIDTH }}>
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
              <div className="flex items-center justify-between px-3 py-2">
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

      {/* Mobile: FAB trigger */}
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

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 h-[85dvh] bg-background rounded-t-lg border-t flex flex-col animate-in slide-in-from-bottom duration-200">
            <button onClick={() => setMobileOpen(false)} className="flex justify-center py-2 cursor-pointer">
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </button>
            {chatContent}
          </div>
        </div>
      )}
    </>
  );
}
