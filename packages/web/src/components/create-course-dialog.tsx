"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/color-picker";
import { createCourse } from "@/app/actions/courses";
import { FolderPlus } from "lucide-react";

interface CreateCourseDialogProps {
  parentId?: number;
  triggerLabel?: string;
}

export function CreateCourseDialog({ parentId, triggerLabel }: CreateCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    try {
      await createCourse({
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || "",
        color: (formData.get("color") as string) || "#6366f1",
        parentId,
      });
      setOpen(false);
    } catch (error) {
      console.error("Failed to create course:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">{triggerLabel ?? "Create Course"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentId ? "Create Sub-Course" : "Create New Course"}</DialogTitle>
          <DialogDescription>
            Organize your decks into a course for structured learning.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
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
              {isLoading ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
