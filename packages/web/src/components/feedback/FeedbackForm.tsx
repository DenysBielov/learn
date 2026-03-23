"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bug, Palette, Lightbulb, Loader2, ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import type { FeedbackCategory, FeedbackPriority, FeedbackLabel } from "./types";

interface FeedbackFormProps {
  onSubmit: (
    category: FeedbackCategory,
    title: string,
    description: string,
    options?: { priority?: FeedbackPriority; requiresPlanning?: boolean; labels?: FeedbackLabel[] }
  ) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  metadata: {
    url: string;
    browser: string;
    viewport: string;
  };
  children?: React.ReactNode;
}

const categories: { id: FeedbackCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "bug", label: "Bug", icon: <Bug className="size-4" />, description: "Something is broken" },
  { id: "visual", label: "Visual Issue", icon: <Palette className="size-4" />, description: "Layout or styling problem" },
  { id: "suggestion", label: "Suggestion", icon: <Lightbulb className="size-4" />, description: "Idea for improvement" },
];

const priorities: { id: FeedbackPriority; label: string; color: string }[] = [
  { id: "urgent", label: "Urgent", color: "bg-red-500" },
  { id: "high", label: "High", color: "bg-orange-500" },
  { id: "medium", label: "Medium", color: "bg-yellow-500" },
  { id: "low", label: "Low", color: "bg-blue-500" },
  { id: "none", label: "Auto", color: "bg-zinc-400" },
];

const availableLabels: { id: FeedbackLabel; label: string }[] = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "design", label: "Design" },
  { id: "performance", label: "Performance" },
  { id: "accessibility", label: "Accessibility" },
  { id: "ux", label: "UX" },
];

export function FeedbackForm({ onSubmit, onCancel, isSubmitting, metadata, children }: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [priority, setPriority] = useState<FeedbackPriority>("none");
  const [requiresPlanning, setRequiresPlanning] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<FeedbackLabel[]>([]);

  const toggleLabel = (label: FeedbackLabel) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && description.trim()) {
      const options = showAdvanced
        ? {
            priority: priority !== "none" ? priority : undefined,
            requiresPlanning: requiresPlanning || undefined,
            labels: selectedLabels.length > 0 ? selectedLabels : undefined,
          }
        : undefined;
      onSubmit(category, title.trim(), description.trim(), options);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-w-0 min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto space-y-4">
        {children}

        <div className="space-y-2">
          <Label>Category</Label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                  category === cat.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {cat.icon}
                <span className="text-xs font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {categories.find((c) => c.id === category)?.description}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of the issue..."
            className="w-full p-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you noticed in detail..."
            className="w-full min-h-[80px] p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="size-3.5" />
              <span>Advanced options</span>
              {(priority !== "none" || requiresPlanning || selectedLabels.length > 0) && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </div>
            <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>

          {showAdvanced && (
            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <div className="flex flex-wrap gap-1.5">
                  {priorities.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        priority === p.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 text-muted-foreground"
                      }`}
                    >
                      <span className={`size-2 rounded-full ${p.color}`} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="requires-planning" className="text-xs cursor-pointer">
                  Requires planning
                </Label>
                <button
                  id="requires-planning"
                  type="button"
                  role="switch"
                  aria-checked={requiresPlanning}
                  onClick={() => setRequiresPlanning((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    requiresPlanning ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                      requiresPlanning ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Labels</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableLabels.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        selectedLabels.includes(l.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 text-muted-foreground"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-0.5 min-w-0">
          <p className="truncate min-w-0">Page: {metadata.url}</p>
          <p className="truncate min-w-0">Browser: {metadata.browser}</p>
          <p className="truncate min-w-0">Viewport: {metadata.viewport}</p>
          {category === "bug" && (
            <p className="text-muted-foreground/70">Console logs & network errors will be attached</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-3 mt-3 border-t border-border shrink-0">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || !description.trim() || isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </div>
    </form>
  );
}
