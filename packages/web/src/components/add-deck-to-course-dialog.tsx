"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { addDeckToCourse, getAvailableDecks } from "@/app/actions/courses";
import { Plus } from "lucide-react";

interface AddDeckToCourseDialogProps {
  courseId: number;
}

export function AddDeckToCourseDialog({ courseId }: AddDeckToCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [decks, setDecks] = useState<{ id: number; name: string }[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");

  useEffect(() => {
    if (open) {
      getAvailableDecks(courseId).then(setDecks);
    }
  }, [open, courseId]);

  async function handleSubmit() {
    if (!selectedDeckId) return;
    setIsLoading(true);
    try {
      await addDeckToCourse(courseId, parseInt(selectedDeckId, 10));
      setOpen(false);
      setSelectedDeckId("");
    } catch (error) {
      console.error("Failed to add deck:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Deck
        </Button>
      </DialogTrigger>
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
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedDeckId}
          >
            {isLoading ? "Adding..." : "Add Deck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
