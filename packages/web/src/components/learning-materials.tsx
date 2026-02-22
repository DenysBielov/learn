"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Youtube, BookOpen, Plus, Trash2, ChevronDown, ChevronRight, StickyNote } from "lucide-react";
import { addLearningMaterial, removeLearningMaterial } from "@/app/actions/learning-materials";

interface LearningMaterial {
  id: number;
  url: string;
  title: string | null;
  type: string;
}

interface LearningMaterialsProps {
  materials: LearningMaterial[];
  flashcardId?: number;
  questionId?: number;
  editable?: boolean;
}

function materialIcon(type: string) {
  switch (type) {
    case "video": return <Youtube className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    case "obsidian": return <StickyNote className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    default: return <ExternalLink className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  }
}

function displayLabel(material: LearningMaterial) {
  if (material.title) return material.title;
  try {
    if (material.url.startsWith("obsidian://")) {
      const params = new URLSearchParams(material.url.split("?")[1] || "");
      return params.get("file") || params.get("vault") || material.url;
    }
    const url = new URL(material.url);
    return url.hostname + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return material.url;
  }
}

export function LearningMaterials({ materials, flashcardId, questionId, editable = false }: LearningMaterialsProps) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (materials.length === 0 && !editable) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      await addLearningMaterial(url.trim(), flashcardId, questionId, title.trim() || undefined);
      setUrl("");
      setTitle("");
      setAdding(false);
    } catch (error) {
      console.error("Failed to add material:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: number) {
    setDeletingId(id);
    try {
      await removeLearningMaterial(id);
    } catch (error) {
      console.error("Failed to remove material:", error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <BookOpen className="h-3 w-3" />
        Materials{materials.length > 0 && ` (${materials.length})`}
      </button>

      {expanded && (
        <div className="mt-1.5 ml-4 space-y-1">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 group">
              {materialIcon(m.type)}
              <a
                href={m.url}
                target={m.type === "obsidian" ? "_self" : "_blank"}
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
              >
                {displayLabel(m)}
              </a>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(m.id)}
                  disabled={deletingId === m.id}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}

          {editable && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add URL
            </button>
          )}

          {editable && adding && (
            <form onSubmit={handleAdd} className="flex flex-col gap-1.5">
              <Input
                type="text"
                placeholder="https://... or obsidian://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              <Input
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex gap-1.5">
                <Button type="submit" size="sm" className="h-6 text-xs" disabled={submitting || !url.trim()}>
                  {submitting ? "Adding..." : "Add"}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setAdding(false); setUrl(""); setTitle(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
