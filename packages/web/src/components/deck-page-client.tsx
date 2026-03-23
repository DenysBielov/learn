"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FlashcardList } from "@/components/flashcard-list";
import { TagFilter } from "@/components/tag-filter";
import { TagPopoverInner } from "@/components/tag-popover";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { CreateFlashcardDialog } from "@/components/create-flashcard-dialog";
import { DeckStudyButton } from "@/components/deck-study-button";
import { BookOpen, RotateCcw, CheckSquare } from "lucide-react";
import type { Tag } from "@/lib/tags";

interface FlashcardTag {
  tag: Tag;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
  tags?: FlashcardTag[];
  learningMaterials: { id: number; url: string; title: string | null; type: string }[];
}

interface DeckPageClientProps {
  deck: {
    id: number;
    name: string;
    description: string | null;
    flashcards: Flashcard[];
  };
  allTags: Tag[];
}

export function DeckPageClient({ deck, allTags }: DeckPageClientProps) {
  const [activeTagIds, setActiveTagIds] = useState<number[]>([]);
  const [selectedFlashcardIds, setSelectedFlashcardIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkPopoverOpen, setBulkPopoverOpen] = useState(false);

  // Compute tag counts for flashcards
  const flashcardTagCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const card of deck.flashcards) {
      for (const ft of card.tags ?? []) {
        counts.set(ft.tag.id, (counts.get(ft.tag.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [deck.flashcards]);

  // Tags present on items with counts
  const flashcardFilterTags = useMemo(() => {
    const tagMap = new Map<number, Tag>();
    for (const card of deck.flashcards) {
      for (const ft of card.tags ?? []) {
        tagMap.set(ft.tag.id, ft.tag);
      }
    }
    return Array.from(tagMap.values()).map((t) => ({
      ...t,
      count: flashcardTagCounts.get(t.id) ?? 0,
    }));
  }, [deck.flashcards, flashcardTagCounts]);

  // Filter flashcards by active tags (AND logic)
  const filteredFlashcards = useMemo(() => {
    if (activeTagIds.length === 0) return deck.flashcards;
    return deck.flashcards.filter((card) => {
      const cardTagIds = new Set((card.tags ?? []).map((t) => t.tag.id));
      return activeTagIds.every((id) => cardTagIds.has(id));
    });
  }, [deck.flashcards, activeTagIds]);

  const handleToggleTag = useCallback((tagId: number) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleClearFilters = useCallback(() => setActiveTagIds([]), []);

  const toggleFlashcardSelection = useCallback((id: number) => {
    setSelectedFlashcardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedFlashcardIds(new Set());
    setSelectionMode(false);
  }, []);

  const selectedCount = selectedFlashcardIds.size;

  // Compute tag counts for bulk selection
  const bulkTagCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const card of deck.flashcards) {
      if (!selectedFlashcardIds.has(card.id)) continue;
      for (const ft of card.tags ?? []) {
        counts.set(ft.tag.id, (counts.get(ft.tag.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [deck.flashcards, selectedFlashcardIds]);

  // Build study links with tag params
  const tagParam = activeTagIds.length > 0 ? `&tags=${activeTagIds.join(",")}` : "";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <DeckStudyButton
          deckId={deck.id}
          studyUrl={`/study/${deck.id}${activeTagIds.length > 0 ? `?tags=${activeTagIds.join(",")}` : ""}`}
          label="Study Due"
          icon={<BookOpen className="mr-2 h-4 w-4" />}
        />
        <DeckStudyButton
          deckId={deck.id}
          studyUrl={`/study/${deck.id}?mode=all${tagParam}`}
          label="Study All"
          icon={<RotateCcw className="mr-2 h-4 w-4" />}
          variant="outline"
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Flashcards ({deck.flashcards.length})
          </h2>
          <div className="flex gap-2">
            <Button
              variant={selectionMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) {
                  setSelectedFlashcardIds(new Set());
                }
              }}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              Select
            </Button>
            <CreateFlashcardDialog deckId={deck.id} />
          </div>
        </div>
        <TagFilter
          tags={flashcardFilterTags}
          activeTagIds={activeTagIds}
          onToggle={handleToggleTag}
          onClear={handleClearFilters}
          totalCount={deck.flashcards.length}
          filteredCount={filteredFlashcards.length}
        />
        <FlashcardList
          flashcards={filteredFlashcards}
          deckId={deck.id}
          allTags={allTags}
          selectable={selectionMode}
          selectedIds={selectedFlashcardIds}
          onSelectionChange={toggleFlashcardSelection}
        />
      </div>

      {selectionMode && selectedCount > 0 && (
        <>
          <BulkActionBar
            selectedCount={selectedCount}
            onTag={() => setBulkPopoverOpen(true)}
            onDeselectAll={handleDeselectAll}
          />
          {bulkPopoverOpen && (
            <BulkTagModal
              allTags={allTags}
              selectedItemIds={Array.from(selectedFlashcardIds)}
              itemType="flashcard"
              deckId={deck.id}
              tagCounts={bulkTagCounts}
              onClose={() => setBulkPopoverOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}

function BulkTagModal({
  allTags,
  selectedItemIds,
  itemType,
  deckId,
  tagCounts,
  onClose,
}: {
  allTags: Tag[];
  selectedItemIds: number[];
  itemType: "flashcard" | "question";
  deckId: number;
  tagCounts: Map<number, number>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-popover rounded-lg border p-4 w-72 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <TagPopoverInner
          mode="bulk"
          allTags={allTags}
          selectedItemIds={selectedItemIds}
          itemType={itemType}
          deckId={deckId}
          tagCounts={tagCounts}
        />
      </div>
    </div>
  );
}
