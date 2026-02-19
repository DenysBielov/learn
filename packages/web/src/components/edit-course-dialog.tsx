"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/color-picker";
import { updateCourse, deleteCourse } from "@/app/actions/courses";
import { Settings, Trash2 } from "lucide-react";

interface EditCourseDialogProps {
  course: {
    id: number;
    name: string;
    description: string;
    color: string;
  };
}

export function EditCourseDialog({ course }: EditCourseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    try {
      await updateCourse(course.id, {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        color: formData.get("color") as string,
      });
      setOpen(false);
    } catch (error) {
      console.error("Failed to update course:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    setIsLoading(true);
    try {
      await deleteCourse(course.id);
      router.push("/");
    } catch (error) {
      console.error("Failed to delete course:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setConfirmDelete(false); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>Update course details or delete it.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input id="edit-name" name="name" defaultValue={course.name} required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" name="description" defaultValue={course.description} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker name="color" defaultValue={course.color} disabled={isLoading} />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <div>
              {!confirmDelete ? (
                <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={isLoading}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </Button>
              ) : (
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isLoading}>
                  Confirm Delete
                </Button>
              )}
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
