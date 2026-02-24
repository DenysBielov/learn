"use client";

import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CourseTree, type TreeItem } from "@/components/course-tree";
import { CourseDetailPanel } from "@/components/course-detail-panel";

interface CourseSplitLayoutProps {
  courseId: number;
  items: TreeItem[];
}

function getItemId(item: TreeItem): string {
  if (item.type === "step") return `step-${item.id}`;
  if (item.type === "deck") return `deck-${item.deckId}`;
  return `course-${item.id}`;
}

export function CourseSplitLayout({ courseId, items }: CourseSplitLayoutProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items.length > 0 ? getItemId(items[0]) : null
  );

  const selectedItem = items.find(item => getItemId(item) === selectedId) ?? null;

  return (
    <>
      {/* Desktop: Resizable split */}
      <div className="hidden md:block border rounded-[10px] overflow-hidden bg-[var(--panel-bg)]" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="35%" minSize="25%" maxSize="50%">
            <div className="h-full overflow-y-auto">
              <div className="px-3 py-2 border-b">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course Content</h3>
              </div>
              <CourseTree items={items} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="65%">
            <div className="h-full overflow-y-auto bg-background">
              <CourseDetailPanel item={selectedItem} courseId={courseId} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: stacked list */}
      <div className="md:hidden">
        <CourseTree items={items} selectedId={selectedId} onSelect={setSelectedId} />
        {selectedItem && (
          <div className="mt-4 bg-card border rounded-[10px]">
            <CourseDetailPanel item={selectedItem} courseId={courseId} />
          </div>
        )}
      </div>
    </>
  );
}
