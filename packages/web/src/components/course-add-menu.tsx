"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/color-picker";
import { createCourse, addDeckToCourse, getAvailableDecks } from "@/app/actions/courses";
import { createMaterial } from "@/app/actions/materials";
import { createQuiz } from "@/app/actions/quizzes";
import { Plus, FolderPlus, Library, BookOpen, Brain } from "lucide-react";

interface CourseAddMenuProps {
  courseId: number;
}

type ActiveDialog = null | "subcourse" | "deck" | "material" | "quiz";

export function CourseAddMenu({ courseId }: CourseAddMenuProps) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Deck dialog state
  const [decks, setDecks] = useState<{ id: number; name: string }[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");

  // Material dialog state
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");

  // Quiz dialog state
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");

  useEffect(() => {
    if (activeDialog === "deck") {
      getAvailableDecks(courseId).then(setDecks);
    }
  }, [activeDialog, courseId]);

  function closeDialog() {
    setActiveDialog(null);
    setSelectedDeckId("");
    setMaterialTitle("");
    setMaterialDescription("");
    setMaterialContent("");
    setMaterialUrl("");
    setQuizTitle("");
    setQuizDescription("");
  }

  async function handleCreateSubcourse(formData: FormData) {
    setIsLoading(true);
    try {
      await createCourse({
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || "",
        color: (formData.get("color") as string) || "#6366f1",
        parentId: courseId,
      });
      closeDialog();
      router.refresh();
    } catch (error) {
      console.error("Failed to create sub-course:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddDeck() {
    if (!selectedDeckId) return;
    setIsLoading(true);
    try {
      await addDeckToCourse(courseId, parseInt(selectedDeckId, 10));
      closeDialog();
      router.refresh();
    } catch (error) {
      console.error("Failed to add deck:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCreateMaterial() {
    if (!materialTitle.trim() || (!materialContent.trim() && !materialUrl.trim())) return;
    startTransition(async () => {
      try {
        await createMaterial(courseId, {
          title: materialTitle.trim(),
          description: materialDescription.trim() || undefined,
          content: materialContent.trim() || undefined,
          externalUrl: materialUrl.trim() || undefined,
        });
        closeDialog();
        router.refresh();
      } catch (error) {
        console.error("Failed to create material:", error);
      }
    });
  }

  function handleCreateQuiz() {
    if (!quizTitle.trim()) return;
    startTransition(async () => {
      try {
        await createQuiz(courseId, {
          title: quizTitle.trim(),
          description: quizDescription.trim() || undefined,
        });
        closeDialog();
        router.refresh();
      } catch (error) {
        console.error("Failed to create quiz:", error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setActiveDialog("subcourse")}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Sub-Course
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveDialog("deck")}>
            <Library className="mr-2 h-4 w-4" />
            Deck
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveDialog("material")}>
            <BookOpen className="mr-2 h-4 w-4" />
            Material
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveDialog("quiz")}>
            <Brain className="mr-2 h-4 w-4" />
            Quiz
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sub-Course Dialog */}
      <Dialog open={activeDialog === "subcourse"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sub-Course</DialogTitle>
            <DialogDescription>
              Organize your decks into a course for structured learning.
            </DialogDescription>
          </DialogHeader>
          <form action={handleCreateSubcourse}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="course-name">Name *</Label>
                <Input id="course-name" name="name" placeholder="e.g., FAANG Prep" required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-desc">Description</Label>
                <Textarea id="course-desc" name="description" placeholder="Optional description" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker name="color" disabled={isLoading} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deck Dialog */}
      <Dialog open={activeDialog === "deck"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deck to Course</DialogTitle>
            <DialogDescription>
              Link an existing deck to this course.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select a deck</Label>
            {decks.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">
                No available decks to add. All decks are already in this course.
              </p>
            ) : (
              <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a deck..." />
                </SelectTrigger>
                <SelectContent>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={String(deck.id)}>
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleAddDeck} disabled={isLoading || !selectedDeckId}>
              {isLoading ? "Adding..." : "Add Deck"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Dialog */}
      <Dialog open={activeDialog === "material"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                placeholder="e.g., Introduction to Linear Algebra"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-description">Description (optional)</Label>
              <Textarea
                id="material-description"
                value={materialDescription}
                onChange={(e) => setMaterialDescription(e.target.value)}
                placeholder="Brief overview of this material..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-content">Content (Markdown)</Label>
              <Textarea
                id="material-content"
                value={materialContent}
                onChange={(e) => setMaterialContent(e.target.value)}
                placeholder="Write your learning material here..."
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-url">External URL (optional)</Label>
              <Input
                id="material-url"
                value={materialUrl}
                onChange={(e) => setMaterialUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Provide content, an external URL, or both.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateMaterial}
              disabled={isPending || !materialTitle.trim() || (!materialContent.trim() && !materialUrl.trim())}
            >
              {isPending ? "Creating..." : "Create Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Dialog */}
      <Dialog open={activeDialog === "quiz"} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Title</Label>
              <Input
                id="quiz-title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="e.g., Chapter 1 Assessment"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-description">Description (optional)</Label>
              <Textarea
                id="quiz-description"
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                placeholder="What this quiz covers..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateQuiz}
              disabled={isPending || !quizTitle.trim()}
            >
              {isPending ? "Creating..." : "Create Quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
