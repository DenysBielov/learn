"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Info, MessageCircle, StickyNote, PanelRightClose } from "lucide-react";
import { MaterialDetailsTab } from "./material-details-tab";
import { MaterialChat } from "./material-chat";
import { MaterialNotes } from "./material-notes";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "material-panel-collapsed";
const STORAGE_KEY_WIDTH = "material-panel-width";
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const RAIL_WIDTH = 48;

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? false : stored === "true";
  } catch {
    return false;
  }
}

interface MaterialPanelProps {
  materialId: number;
  linkedDecks: Array<{ id: number; name: string; flashcardCount: number }>;
  linkedQuizzes: Array<{ id: number; title: string }>;
  resources: Array<{ id: number; url: string; title: string | null; type: string }>;
  initialNotes: string | null;
  externalUrl: string | null;
}

export function MaterialPanel({
  materialId,
  linkedDecks,
  linkedQuizzes,
  resources,
  initialNotes,
  externalUrl,
}: MaterialPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "chat" | "notes">("details");
  const [hasUnread, setHasUnread] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const unreadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isMobile = useIsMobile();

  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  // Hydrate from localStorage
  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    try {
      const stored = localStorage.getItem(STORAGE_KEY_WIDTH);
      if (stored) {
        const parsed = Number(stored);
        if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) setWidth(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch { /* ignore */ }
  }, [collapsed]);

  // Resize handle
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
      if (outerRef.current) outerRef.current.style.width = `${newWidth}px`;
      if (asideRef.current) asideRef.current.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      const finalWidth = widthRef.current;
      setWidth(finalWidth);
      setIsResizing(false);
      try { localStorage.setItem(STORAGE_KEY_WIDTH, String(finalWidth)); } catch { /* ignore */ }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const expand = useCallback((tab?: "details" | "chat" | "notes") => {
    if (tab) setActiveTab(tab);
    setCollapsed(false);
    if (tab === "chat" || !tab) {
      unreadTimerRef.current = setTimeout(() => {
        setHasUnread(false);
      }, 1500);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (unreadTimerRef.current) clearTimeout(unreadTimerRef.current);
    };
  }, []);

  const handleNewMessage = useCallback(() => {
    if (collapsedRef.current) setHasUnread(true);
  }, []);

  const panelContent = (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "details" | "chat" | "notes")}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="px-4">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1 cursor-pointer gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Details
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 cursor-pointer gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 cursor-pointer gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            Notes
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="details" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <MaterialDetailsTab
          linkedDecks={linkedDecks}
          linkedQuizzes={linkedQuizzes}
          resources={resources}
          externalUrl={externalUrl}
        />
      </TabsContent>

      <TabsContent value="chat" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <MaterialChat materialId={materialId} onNewMessage={handleNewMessage} />
      </TabsContent>

      <TabsContent value="notes" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <MaterialNotes materialId={materialId} initialNotes={initialNotes} />
      </TabsContent>
    </Tabs>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        ref={outerRef}
        className={`hidden md:block flex-shrink-0 h-full overflow-hidden ${isResizing ? "" : "transition-[width] duration-200 ease-in-out"}`}
        style={{ width: collapsed ? RAIL_WIDTH : width }}
      >
        <aside
          ref={asideRef}
          className="relative flex h-full flex-col border-l bg-background"
          style={{ width }}
        >
          {/* Resize handle */}
          {!collapsed && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize group"
            >
              <div className="absolute inset-y-0 left-0 w-0.5 group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors" />
            </div>
          )}
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 py-3" style={{ width: RAIL_WIDTH }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 cursor-pointer"
                onClick={() => expand("details")}
                title="Details"
              >
                <Info className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 cursor-pointer"
                onClick={() => expand("chat")}
                title="Chat"
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
                title="Notes"
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium">Material Panel</span>
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
              {!isMobile && panelContent}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile: FAB + bottom sheet */}
      {!mobileOpen && (
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg cursor-pointer md:hidden"
          onClick={() => {
            setMobileOpen(true);
            setHasUnread(false);
          }}
          title="Material details"
        >
          <Info className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-destructive" />
          )}
        </Button>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[85dvh] bg-background rounded-t-lg border-t flex flex-col animate-in slide-in-from-bottom duration-200">
            <button
              onClick={() => setMobileOpen(false)}
              className="flex justify-center py-2 cursor-pointer"
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </button>
            {panelContent}
          </div>
        </div>
      )}
    </>
  );
}
