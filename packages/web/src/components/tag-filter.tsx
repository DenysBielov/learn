"use client";

import { TagBadge } from "@/components/tag-badge";
import { Button } from "@/components/ui/button";
import type { Tag } from "@/lib/tags";

interface TagWithCount extends Tag {
  count: number;
}

interface TagFilterProps {
  tags: TagWithCount[];
  activeTagIds: number[];
  onToggle: (tagId: number) => void;
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
}

export function TagFilter({
  tags,
  activeTagIds,
  onToggle,
  onClear,
  totalCount,
  filteredCount,
}: TagFilterProps) {
  if (tags.length === 0) return null;

  const hasActiveFilters = activeTagIds.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            count={tag.count}
            active={activeTagIds.includes(tag.id)}
            onClick={() => onToggle(tag.id)}
            className={tag.count === 0 ? "opacity-50" : undefined}
          />
        ))}
      </div>
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Showing {filteredCount} of {totalCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs px-1.5"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
