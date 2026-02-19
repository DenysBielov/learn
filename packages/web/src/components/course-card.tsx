import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleActiveButton } from "@/components/toggle-active-button";

interface CourseCardProps {
  id: number;
  name: string;
  description: string;
  color: string;
  totalDecks: number;
  dueCards: number;
  isActive: boolean;
}

export function CourseCard({ id, name, description, color, totalDecks, dueCards, isActive }: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`} className="block transition-transform hover:scale-[1.02]">
      <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: color }} />
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{name}</CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {dueCards > 0 && (
                <Badge variant="destructive" className="shrink-0">
                  {dueCards} due
                </Badge>
              )}
              <ToggleActiveButton courseId={id} isActive={isActive} />
            </div>
          </div>
          <CardDescription>{description || "No description"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {totalDecks} deck{totalDecks !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
