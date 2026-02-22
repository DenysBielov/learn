"use client";

import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FlashcardList } from "@/components/flashcard-list";
import { QuestionList } from "@/components/question-list";
import { TagFilter } from "@/components/tag-filter";
import { TagPopoverInner } from "@/components/tag-popover";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { CreateFlashcardDialog } from "@/components/create-flashcard-dialog";
import { CreateQuestionDialog } from "@/components/create-question-dialog";
import Link from "next/link";
import { BookOpen, Brain, RotateCcw, CheckSquare } from "lucide-react";
import type { Tag } from "@/lib/tags";

interface FlashcardTag {
  tag: Tag;
}

interface Flashcard {
  id: number;
  front: string;
  back: string;
  tags?: FlashcardTag[];
}

interface QuestionOption {
  id: number;
  optionText: string;
  isCorrect: boolean;
}

interface QuestionTag {
  tag: Tag;
}

interface QuizQuestion {
  id: number;
  question: string;
  type: string;
  options: QuestionOption[];
  correctAnswer?: string | null;
  tags?: QuestionTag[];
}

interface DeckPageClientProps {
  deck: {
    id: number;
    name: string;
    description: string | null;
    flashcards: Flashcard[];
    quizQuestions: QuizQuestion[];
  };
  allTags: Tag[];
}

export function DeckPageClient({ deck, allTags }: DeckPageClientProps) {
  const [activeTagIds, setActiveTagIds] = useState<number[]>([]);
  const [selectedFlashcardIds, setSelectedFlashcardIds] = useState<Set<number>>(new Set());
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeTab, setActiveTab] = useState("flashcards");
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

  // Compute tag counts for questions
  const questionTagCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const q of deck.quizQuestions) {
      for (const qt of q.tags ?? []) {
        counts.set(qt.tag.id, (counts.get(qt.tag.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [deck.quizQuestions]);

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

  const questionFilterTags = useMemo(() => {
    const tagMap = new Map<number, Tag>();
    for (const q of deck.quizQuestions) {
      for (const qt of q.tags ?? []) {
        tagMap.set(qt.tag.id, qt.tag);
      }
    }
    return Array.from(tagMap.values()).map((t) => ({
      ...t,
      count: questionTagCounts.get(t.id) ?? 0,
    }));
  }, [deck.quizQuestions, questionTagCounts]);

  // Filter flashcards by active tags (AND logic)
  const filteredFlashcards = useMemo(() => {
    if (activeTagIds.length === 0) return deck.flashcards;
    return deck.flashcards.filter((card) => {
      const cardTagIds = new Set((card.tags ?? []).map((t) => t.tag.id));
      return activeTagIds.every((id) => cardTagIds.has(id));
    });
  }, [deck.flashcards, activeTagIds]);

  const filteredQuestions = useMemo(() => {
    if (activeTagIds.length === 0) return deck.quizQuestions;
    return deck.quizQuestions.filter((q) => {
      const qTagIds = new Set((q.tags ?? []).map((t) => t.tag.id));
      return activeTagIds.every((id) => qTagIds.has(id));
    });
  }, [deck.quizQuestions, activeTagIds]);

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

  const toggleQuestionSelection = useCallback((id: number) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedFlashcardIds(new Set());
    setSelectedQuestionIds(new Set());
    setSelectionMode(false);
  }, []);

  const selectedCount = activeTab === "flashcards"
    ? selectedFlashcardIds.size
    : selectedQuestionIds.size;

  // Compute tag counts for bulk selection
  const bulkTagCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (activeTab === "flashcards") {
      for (const card of deck.flashcards) {
        if (!selectedFlashcardIds.has(card.id)) continue;
        for (const ft of card.tags ?? []) {
          counts.set(ft.tag.id, (counts.get(ft.tag.id) ?? 0) + 1);
        }
      }
    } else {
      for (const q of deck.quizQuestions) {
        if (!selectedQuestionIds.has(q.id)) continue;
        for (const qt of q.tags ?? []) {
          counts.set(qt.tag.id, (counts.get(qt.tag.id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [activeTab, deck.flashcards, deck.quizQuestions, selectedFlashcardIds, selectedQuestionIds]);

  // Build study/quiz links with tag params
  const tagParam = activeTagIds.length > 0 ? `&tags=${activeTagIds.join(",")}` : "";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/study/${deck.id}${activeTagIds.length > 0 ? `?tags=${activeTagIds.join(",")}` : ""}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Study Due
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/study/${deck.id}?mode=all${tagParam}`}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Study All
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/quiz/${deck.id}`}>
            <Brain className="mr-2 h-4 w-4" />
            Take Quiz
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        setSelectedFlashcardIds(new Set());
        setSelectedQuestionIds(new Set());
        setSelectionMode(false);
      }} className="w-full">
        <TabsList>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="questions">Quiz Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="flashcards" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Quiz Questions ({deck.quizQuestions.length})
            </h2>
            <div className="flex gap-2">
              <Button
                variant={selectionMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) {
                    setSelectedQuestionIds(new Set());
                  }
                }}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select
              </Button>
              <CreateQuestionDialog deckId={deck.id} />
            </div>
          </div>
          <TagFilter
            tags={questionFilterTags}
            activeTagIds={activeTagIds}
            onToggle={handleToggleTag}
            onClear={handleClearFilters}
            totalCount={deck.quizQuestions.length}
            filteredCount={filteredQuestions.length}
          />
          <QuestionList
            questions={filteredQuestions}
            deckId={deck.id}
            allTags={allTags}
            selectable={selectionMode}
            selectedIds={selectedQuestionIds}
            onSelectionChange={toggleQuestionSelection}
          />
        </TabsContent>
      </Tabs>

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
              selectedItemIds={Array.from(
                activeTab === "flashcards" ? selectedFlashcardIds : selectedQuestionIds
              )}
              itemType={activeTab === "flashcards" ? "flashcard" : "question"}
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
