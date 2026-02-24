"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichContent } from "@/components/rich-content";
import { Layers, Brain, BookOpen } from "lucide-react";
import Link from "next/link";

interface MaterialTabsProps {
  content: string | null;
  linkedDecks: Array<{ id: number; name: string; flashcardCount: number }>;
  linkedQuizzes: Array<{ id: number; title: string }>;
}

export function MaterialTabs({ content, linkedDecks, linkedQuizzes }: MaterialTabsProps) {
  return (
    <Tabs defaultValue="content" className="w-full">
      <TabsList variant="line" className="w-full justify-start border-b border-border h-auto p-0 gap-0">
        <TabsTrigger value="content" className="px-4 py-2">
          <BookOpen className="h-4 w-4" />
          Content
        </TabsTrigger>
        {linkedDecks.length > 0 && (
          <TabsTrigger value="flashcards" className="px-4 py-2">
            <Layers className="h-4 w-4" />
            Flashcards ({linkedDecks.reduce((sum, d) => sum + d.flashcardCount, 0)})
          </TabsTrigger>
        )}
        {linkedQuizzes.length > 0 && (
          <TabsTrigger value="quizzes" className="px-4 py-2">
            <Brain className="h-4 w-4" />
            Quizzes ({linkedQuizzes.length})
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="content" className="mt-4">
        {content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <RichContent content={content} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No content available</p>
        )}
      </TabsContent>

      {linkedDecks.length > 0 && (
        <TabsContent value="flashcards" className="mt-4">
          <div className="space-y-2">
            {linkedDecks.map(deck => (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="block bg-card border rounded-[10px] p-4 transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{deck.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{deck.flashcardCount} cards</span>
                </div>
              </Link>
            ))}
          </div>
        </TabsContent>
      )}

      {linkedQuizzes.length > 0 && (
        <TabsContent value="quizzes" className="mt-4">
          <div className="space-y-2">
            {linkedQuizzes.map(quiz => (
              <Link
                key={quiz.id}
                href={`/quizzes/${quiz.id}`}
                className="block bg-card border rounded-[10px] p-4 transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]"
              >
                <div className="flex items-center gap-3">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{quiz.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
