"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Info, MessageCircle, StickyNote } from "lucide-react";
import { MaterialDetailsTab } from "./material-details-tab";
import { MaterialChat } from "./material-chat";
import { MaterialNotes } from "./material-notes";
import { useIsMobile } from "@/hooks/use-mobile";

interface MaterialPanelProps {
  materialId: number;
  linkedDecks: Array<{ id: number; name: string; flashcardCount: number }>;
  linkedQuizzes: Array<{ id: number; title: string }>;
  initialNotes: string | null;
  externalUrl: string | null;
}

export function MaterialPanel({
  materialId,
  linkedDecks,
  linkedQuizzes,
  initialNotes,
  externalUrl,
}: MaterialPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "chat" | "notes">("details");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const isMobile = useIsMobile();

  const handleNewMessage = () => {
    if (!mobileOpen) setHasUnread(true);
  };

  const panelContent = (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "details" | "chat" | "notes")}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="px-4 pt-3 shrink-0">
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
      {/* Desktop: full-height panel — rendered by the parent ResizablePanelGroup */}
      {!isMobile && (
        <div className="hidden md:flex h-full flex-col border-l bg-background overflow-hidden">
          {panelContent}
        </div>
      )}

      {/* Mobile: FAB + bottom sheet */}
      {isMobile && (
        <>
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
      )}
    </>
  );
}
