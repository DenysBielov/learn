"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tags, XCircle } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onTag: () => void;
  onDeselectAll: () => void;
}

export function BulkActionBar({ selectedCount, onTag, onDeselectAll }: BulkActionBarProps) {
  // Hide mobile bottom nav while bulk bar is active
  useEffect(() => {
    document.body.classList.add("bulk-action-active");
    return () => document.body.classList.remove("bulk-action-active");
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-background border-t p-3 flex items-center justify-between gap-3 shadow-lg">
      <span className="text-sm font-medium">
        {selectedCount} selected
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onTag}>
          <Tags className="h-4 w-4 mr-1.5" />
          Tag
        </Button>
        <Button size="sm" variant="ghost" onClick={onDeselectAll}>
          <XCircle className="h-4 w-4 mr-1.5" />
          Deselect
        </Button>
      </div>
    </div>
  );
}
