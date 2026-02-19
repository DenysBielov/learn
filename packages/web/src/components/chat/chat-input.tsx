"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Send, X } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string, imageBase64?: string) => void;
  disabled: boolean;
}

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !imageBase64) return;

    onSend(trimmed, imageBase64 ?? undefined);
    setText("");
    setImagePreview(null);
    setImageBase64(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, imageBase64, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      alert("Image must be under 4MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > MAX_IMAGE_SIZE) {
          alert("Image must be under 4MB");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setImagePreview(result);
          setImageBase64(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  return (
    <div className="space-y-2">
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="Upload preview"
            className="h-16 rounded border"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !!imagePreview}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask a question..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && !imageBase64)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
