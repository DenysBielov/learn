"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CourseTree, getItemId, type TreeItem } from "@/components/course-tree";
import { CourseDetailPanel } from "@/components/course-detail-panel";
import { getCourseTreeChildren } from "@/app/actions/courses";

interface CourseSplitLayoutProps {
  items: TreeItem[];
}

export function CourseSplitLayout({ items }: CourseSplitLayoutProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items.length > 0 ? getItemId(items[0]) : null
  );
  const [expandedChildren, setExpandedChildren] = useState<Record<string, TreeItem[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const allItems = Object.values(expandedChildren).flat();
  const selectedItem =
    [...items, ...allItems].find((item) => getItemId(item) === selectedId) ?? null;

  const handleToggleExpand = useCallback(async (courseId: number) => {
    const key = `course-${courseId}`;
    if (expandedChildren[key]) {
      setExpandedChildren((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setLoadingIds((prev) => new Set(prev).add(key));
    try {
      const data = await getCourseTreeChildren(courseId);
      const childItems: TreeItem[] = [
        ...data.children.map((c) => ({ type: "subcourse" as const, ...c })),
        ...data.steps.map((s) => ({ type: "step" as const, ...s })),
        ...data.decks.map((d) => ({ type: "deck" as const, ...d })),
      ];
      setExpandedChildren((prev) => ({ ...prev, [key]: childItems }));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [expandedChildren]);

  const router = useRouter();

  const handleNavigate = useCallback((item: TreeItem) => {
    if (item.type === "subcourse") {
      router.push(`/courses/${item.id}`);
    } else if (item.type === "step") {
      if (item.stepType === "material" && item.materialId) {
        router.push(`/materials/${item.materialId}`);
      } else if (item.stepType === "quiz" && item.quizId) {
        router.push(`/quizzes/${item.quizId}`);
      }
    } else if (item.type === "deck") {
      router.push(`/decks/${item.deckId}`);
    }
  }, [router]);

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
              <CourseTree
                items={items}
                selectedId={selectedId}
                onSelect={setSelectedId}
                expandedChildren={expandedChildren}
                loadingIds={loadingIds}
                onToggleExpand={handleToggleExpand}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="65%">
            <div className="h-full overflow-y-auto bg-background">
              <CourseDetailPanel item={selectedItem} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: navigate on tap */}
      <div className="md:hidden">
        <CourseTree
          items={items}
          selectedId={null}
          onSelect={() => {}}
          onNavigate={handleNavigate}
          expandedChildren={{}}
          loadingIds={new Set()}
          onToggleExpand={() => {}}
        />
      </div>
    </>
  );
}
