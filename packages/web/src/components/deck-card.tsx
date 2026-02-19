import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DeckCardProps {
  id: number;
  name: string;
  description: string;
  flashcardCount: number;
  questionCount: number;
  dueCount: number;
}

export function DeckCard({ id, name, description, flashcardCount, questionCount, dueCount }: DeckCardProps) {
  return (
    <Link href={`/decks/${id}`} className="block transition-transform hover:scale-[1.02]">
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{name}</CardTitle>
            {dueCount > 0 && (
              <Badge variant="destructive" className="shrink-0">
                {dueCount} due
              </Badge>
            )}
          </div>
          <CardDescription>{description || "No description"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {flashcardCount} flashcard{flashcardCount !== 1 ? "s" : ""}, {questionCount} question{questionCount !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
