"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMaterial } from "@/app/actions/materials";
import { createQuiz } from "@/app/actions/quizzes";
import { BookOpen, Brain, Plus } from "lucide-react";

interface AddStepDialogProps {
  courseId: number;
}

type StepType = null | "material" | "quiz";

export function AddStepDialog({ courseId }: AddStepDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepType, setStepType] = useState<StepType>(null);
  const [isPending, startTransition] = useTransition();

  // Material fields
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");

  // Quiz fields
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");

  const reset = () => {
    setStepType(null);
    setMaterialTitle("");
    setMaterialContent("");
    setMaterialUrl("");
    setQuizTitle("");
    setQuizDescription("");
  };

  const handleCreateMaterial = () => {
    if (!materialTitle.trim()) return;
    if (!materialContent.trim() && !materialUrl.trim()) return;

    startTransition(async () => {
      try {
        await createMaterial(courseId, {
          title: materialTitle.trim(),
          content: materialContent.trim() || undefined,
          externalUrl: materialUrl.trim() || undefined,
        });
        reset();
        setOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Failed to create material:", error);
      }
    });
  };

  const handleCreateQuiz = () => {
    if (!quizTitle.trim()) return;

    startTransition(async () => {
      try {
        await createQuiz(courseId, {
          title: quizTitle.trim(),
          description: quizDescription.trim() || undefined,
        });
        reset();
        setOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Failed to create quiz:", error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Step
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {stepType === null && "Add Learning Step"}
            {stepType === "material" && "Add Material"}
            {stepType === "quiz" && "Add Quiz"}
          </DialogTitle>
        </DialogHeader>

        {stepType === null && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setStepType("material")}
              className="flex flex-col items-center gap-3 rounded-lg border p-6 transition-colors hover:bg-accent"
            >
              <BookOpen className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">Material</div>
              <div className="text-xs text-muted-foreground text-center">
                Reading content or external link
              </div>
            </button>
            <button
              onClick={() => setStepType("quiz")}
              className="flex flex-col items-center gap-3 rounded-lg border p-6 transition-colors hover:bg-accent"
            >
              <Brain className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">Quiz</div>
              <div className="text-xs text-muted-foreground text-center">
                Assessment with questions
              </div>
            </button>
          </div>
        )}

        {stepType === "material" && (
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
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStepType(null)}>Back</Button>
              <Button
                onClick={handleCreateMaterial}
                disabled={isPending || !materialTitle.trim() || (!materialContent.trim() && !materialUrl.trim())}
              >
                {isPending ? "Creating..." : "Create Material"}
              </Button>
            </div>
          </div>
        )}

        {stepType === "quiz" && (
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
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStepType(null)}>Back</Button>
              <Button
                onClick={handleCreateQuiz}
                disabled={isPending || !quizTitle.trim()}
              >
                {isPending ? "Creating..." : "Create Quiz"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
