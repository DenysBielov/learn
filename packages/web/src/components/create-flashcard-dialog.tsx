"use client";

import { useState, useRef, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createFlashcard } from "@/app/actions/flashcards";
import { Plus, ImagePlus, Loader2 } from "lucide-react";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

async function uploadImage(file: File): Promise<string | null> {
  if (file.size > MAX_IMAGE_SIZE) {
    alert("Image must be under 4MB");
    return null;
  }
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/images/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) return null;
  const { url } = await res.json();
  return url;
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  setter: (v: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const newValue = value.substring(0, start) + text + value.substring(end);
  setter(newValue);
  requestAnimationFrame(() => {
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
  });
}

interface CreateFlashcardDialogProps {
  deckId: number;
}

export function CreateFlashcardDialog({ deckId }: CreateFlashcardDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    async (
      file: File,
      textareaRef: React.RefObject<HTMLTextAreaElement | null>,
      setUploading: (v: boolean) => void,
      setter: (v: string) => void
    ) => {
      setUploading(true);
      try {
        const url = await uploadImage(file);
        if (url && textareaRef.current) {
          insertAtCursor(textareaRef.current, `![image](${url})`, setter);
        }
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const handleFileSelect = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      textareaRef: React.RefObject<HTMLTextAreaElement | null>,
      setUploading: (v: boolean) => void,
      setter: (v: string) => void
    ) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleImageUpload(file, textareaRef, setUploading, setter);
      e.target.value = "";
    },
    [handleImageUpload]
  );

  const handlePaste = useCallback(
    (
      e: React.ClipboardEvent,
      textareaRef: React.RefObject<HTMLTextAreaElement | null>,
      setUploading: (v: boolean) => void,
      setter: (v: string) => void
    ) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          handleImageUpload(file, textareaRef, setUploading, setter);
          break;
        }
      }
    },
    [handleImageUpload]
  );

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    try {
      await createFlashcard(formData);
      setOpen(false);
      setFront("");
      setBack("");
    } catch (error) {
      console.error("Failed to create flashcard:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Flashcard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Flashcard</DialogTitle>
          <DialogDescription>
            Add a new flashcard to this deck.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <input type="hidden" name="deckId" value={deckId} />
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="front">Front *</Label>
                <input
                  ref={frontFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) =>
                    handleFileSelect(e, frontRef, setUploadingFront, setFront)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => frontFileRef.current?.click()}
                  disabled={isLoading || uploadingFront}
                >
                  {uploadingFront ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                ref={frontRef}
                id="front"
                name="front"
                placeholder="Question or prompt"
                required
                disabled={isLoading}
                rows={3}
                value={front}
                onChange={(e) => setFront(e.target.value)}
                onPaste={(e) => handlePaste(e, frontRef, setUploadingFront, setFront)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="back">Back *</Label>
                <input
                  ref={backFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) =>
                    handleFileSelect(e, backRef, setUploadingBack, setBack)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => backFileRef.current?.click()}
                  disabled={isLoading || uploadingBack}
                >
                  {uploadingBack ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                ref={backRef}
                id="back"
                name="back"
                placeholder="Answer or explanation"
                required
                disabled={isLoading}
                rows={3}
                value={back}
                onChange={(e) => setBack(e.target.value)}
                onPaste={(e) => handlePaste(e, backRef, setUploadingBack, setBack)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Flashcard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
