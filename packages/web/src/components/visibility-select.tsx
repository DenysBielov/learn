"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateVisibility } from "@/app/actions/courses";
import { Globe, Lock, GitFork } from "lucide-react";

interface VisibilitySelectProps {
  courseId: number;
  visibility: "private" | "public" | "forkable";
}

const options = [
  { value: "private", label: "Private", icon: Lock },
  { value: "public", label: "Public", icon: Globe },
  { value: "forkable", label: "Public + Forkable", icon: GitFork },
] as const;

export function VisibilitySelect({ courseId, visibility }: VisibilitySelectProps) {
  const [value, setValue] = useState(visibility);
  const [isPending, startTransition] = useTransition();

  function handleChange(newValue: string) {
    const v = newValue as "private" | "public" | "forkable";
    setValue(v);
    startTransition(async () => {
      try {
        await updateVisibility(courseId, v);
      } catch (error) {
        console.error("Failed to update visibility:", error);
        setValue(visibility);
      }
    });
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="gap-1.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            <opt.icon className="h-3.5 w-3.5" />
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
