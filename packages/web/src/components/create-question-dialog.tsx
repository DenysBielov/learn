"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createQuizQuestion } from "@/app/actions/quiz";
import { Plus, X } from "lucide-react";

interface CreateQuestionDialogProps {
  deckId: number;
}

interface Option {
  text: string;
  isCorrect: boolean;
}

export function CreateQuestionDialog({ deckId }: CreateQuestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<Option[]>([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const question = formData.get("question") as string;
    const explanation = formData.get("explanation") as string;

    const validOptions = options.filter(opt => opt.text.trim() !== "");

    if (validOptions.length < 2) {
      alert("Please provide at least 2 options");
      return;
    }

    if (!validOptions.some(opt => opt.isCorrect)) {
      alert("Please mark at least one option as correct");
      return;
    }

    setIsLoading(true);
    try {
      await createQuizQuestion({
        deckId,
        type: "multiple_choice",
        question,
        explanation: explanation || "",
        options: validOptions.map(opt => ({
          optionText: opt.text,
          isCorrect: opt.isCorrect,
        })),
      });
      setOpen(false);
      setOptions([
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
    } catch (error) {
      console.error("Failed to create question:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function addOption() {
    setOptions([...options, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, field: "text" | "isCorrect", value: string | boolean) {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Quiz Question</DialogTitle>
          <DialogDescription>
            Add a new multiple choice question to this deck.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Textarea
                id="question"
                name="question"
                placeholder="Enter your question"
                required
                disabled={isLoading}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="explanation">Explanation (optional)</Label>
              <Textarea
                id="explanation"
                name="explanation"
                placeholder="Optional explanation shown after answering"
                disabled={isLoading}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Options *</Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex items-center pt-2">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(index, "isCorrect", e.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-gray-300"
                        title="Mark as correct answer"
                      />
                    </div>
                    <Input
                      value={option.text}
                      onChange={(e) => updateOption(index, "text", e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={isLoading}
              >
                <Plus className="mr-2 h-3 w-3" />
                Add Option
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
