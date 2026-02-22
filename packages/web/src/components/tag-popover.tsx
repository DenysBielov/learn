"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { Plus, Check, Minus, MoreHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRESET_COLORS, getContrastColor } from "@/lib/tags";
import type { Tag } from "@/lib/tags";
import {
  createTag,
  assignFlashcardTag,
  removeFlashcardTag,
  assignQuestionTag,
  removeQuestionTag,
  bulkUpdateFlashcardTags,
  bulkUpdateQuestionTags,
  updateTag,
} from "@/app/actions/tags";

type ItemType = "flashcard" | "question";

interface TagPopoverProps {
  allTags: Tag[];
  assignedTagIds: number[];
  itemId: number;
  itemType: ItemType;
  deckId: number;
  onOptimisticUpdate?: (tagId: number, assigned: boolean) => void;
}

interface BulkTagPopoverProps {
  allTags: Tag[];
  selectedItemIds: number[];
  itemType: ItemType;
  deckId: number;
  /** Map of tagId -> count of selected items that have this tag */
  tagCounts: Map<number, number>;
  onDone?: () => void;
}

type TagPopoverCombinedProps =
  | ({ mode: "single" } & TagPopoverProps)
  | ({ mode: "bulk" } & BulkTagPopoverProps);

export function TagPopover(props: TagPopoverCombinedProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const trigger = (
    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
      <Plus className="h-3.5 w-3.5" />
    </Button>
  );

  const content = <TagPopoverInner {...props} onClose={() => setOpen(false)} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle className="sr-only">Manage tags</DrawerTitle>
          <div className="p-4 pb-8 max-h-[70vh] overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
}

function TagPopoverInner(props: TagPopoverCombinedProps & { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [localAssigned, setLocalAssigned] = useState<Set<number>>(() => {
    if (props.mode === "single") return new Set(props.assignedTagIds);
    return new Set<number>();
  });
  const [localBulkAdded, setLocalBulkAdded] = useState<Set<number>>(new Set());
  const [localBulkRemoved, setLocalBulkRemoved] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredTags = props.allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreate = search.trim() &&
    !props.allTags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  const handleToggle = useCallback((tag: Tag) => {
    if (props.mode === "single") {
      const isAssigned = localAssigned.has(tag.id);
      // Optimistic update
      setLocalAssigned((prev) => {
        const next = new Set(prev);
        if (isAssigned) next.delete(tag.id);
        else next.add(tag.id);
        return next;
      });
      props.onOptimisticUpdate?.(tag.id, !isAssigned);

      startTransition(async () => {
        if (isAssigned) {
          if (props.itemType === "flashcard") {
            await removeFlashcardTag(props.itemId, tag.id, props.deckId);
          } else {
            await removeQuestionTag(props.itemId, tag.id, props.deckId);
          }
        } else {
          if (props.itemType === "flashcard") {
            await assignFlashcardTag(props.itemId, tag.id, props.deckId);
          } else {
            await assignQuestionTag(props.itemId, tag.id, props.deckId);
          }
        }
      });
    } else {
      // Bulk mode
      const totalSelected = props.selectedItemIds.length;
      const currentCount = props.tagCounts.get(tag.id) ?? 0;
      const wasAdded = localBulkAdded.has(tag.id);
      const wasRemoved = localBulkRemoved.has(tag.id);

      // Compute effective state
      let effectiveState: "all" | "some" | "none";
      if (wasAdded) effectiveState = "all";
      else if (wasRemoved) effectiveState = "none";
      else if (currentCount === totalSelected) effectiveState = "all";
      else if (currentCount > 0) effectiveState = "some";
      else effectiveState = "none";

      // Toggle: some/none -> all, all -> none
      if (effectiveState === "all") {
        // Remove from all
        setLocalBulkAdded((prev) => { const n = new Set(prev); n.delete(tag.id); return n; });
        setLocalBulkRemoved((prev) => new Set(prev).add(tag.id));
        startTransition(async () => {
          if (props.itemType === "flashcard") {
            await bulkUpdateFlashcardTags(props.selectedItemIds, [], [tag.id], props.deckId);
          } else {
            await bulkUpdateQuestionTags(props.selectedItemIds, [], [tag.id], props.deckId);
          }
        });
      } else {
        // Add to all
        setLocalBulkRemoved((prev) => { const n = new Set(prev); n.delete(tag.id); return n; });
        setLocalBulkAdded((prev) => new Set(prev).add(tag.id));
        startTransition(async () => {
          if (props.itemType === "flashcard") {
            await bulkUpdateFlashcardTags(props.selectedItemIds, [tag.id], [], props.deckId);
          } else {
            await bulkUpdateQuestionTags(props.selectedItemIds, [tag.id], [], props.deckId);
          }
        });
      }
    }
  }, [props, localAssigned, localBulkAdded, localBulkRemoved]);

  const handleCreate = useCallback((color: string) => {
    const name = search.trim();
    if (!name) return;
    setSearch("");

    startTransition(async () => {
      const newTag = await createTag(name, color);
      if (props.mode === "single") {
        setLocalAssigned((prev) => new Set(prev).add(newTag.id));
        if (props.itemType === "flashcard") {
          await assignFlashcardTag(props.itemId, newTag.id, props.deckId);
        } else {
          await assignQuestionTag(props.itemId, newTag.id, props.deckId);
        }
      } else {
        setLocalBulkAdded((prev) => new Set(prev).add(newTag.id));
        if (props.itemType === "flashcard") {
          await bulkUpdateFlashcardTags(props.selectedItemIds, [newTag.id], [], props.deckId);
        } else {
          await bulkUpdateQuestionTags(props.selectedItemIds, [newTag.id], [], props.deckId);
        }
      }
    });
  }, [search, props]);

  function getTagState(tag: Tag): "checked" | "partial" | "unchecked" {
    if (props.mode === "single") {
      return localAssigned.has(tag.id) ? "checked" : "unchecked";
    }

    if (localBulkAdded.has(tag.id)) return "checked";
    if (localBulkRemoved.has(tag.id)) return "unchecked";

    const count = props.tagCounts.get(tag.id) ?? 0;
    const total = props.selectedItemIds.length;
    if (count === total) return "checked";
    if (count > 0) return "partial";
    return "unchecked";
  }

  return (
    <div className="space-y-2">
      <Input
        ref={inputRef}
        placeholder="Search or create tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filteredTags.length === 0 && !showCreate && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No tags yet — type to create one
          </p>
        )}
        {filteredTags.map((tag) =>
          editingTagId === tag.id ? (
            <TagEditRow
              key={tag.id}
              tag={tag}
              onSave={() => setEditingTagId(null)}
              onCancel={() => setEditingTagId(null)}
            />
          ) : (
            <TagRow
              key={tag.id}
              tag={tag}
              state={getTagState(tag)}
              onToggle={() => handleToggle(tag)}
              onEdit={() => setEditingTagId(tag.id)}
              disabled={isPending}
            />
          )
        )}
      </div>
      {showCreate && (
        <CreateTagRow
          name={search.trim()}
          existingCount={props.allTags.length}
          onCreate={handleCreate}
          disabled={isPending}
        />
      )}
    </div>
  );
}

function TagRow({
  tag,
  state,
  onToggle,
  onEdit,
  disabled,
}: {
  tag: Tag;
  state: "checked" | "partial" | "unchecked";
  onToggle: () => void;
  onEdit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded border shrink-0">
          {state === "checked" && <Check className="h-3 w-3" />}
          {state === "partial" && <Minus className="h-3 w-3" />}
        </span>
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: tag.color || "#8b5cf6" }}
        />
        <span className="text-sm truncate">{tag.name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted shrink-0"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TagEditRow({
  tag,
  onSave,
  onCancel,
}: {
  tag: Tag;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color || "#8b5cf6");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateTag(tag.id, name.trim(), color);
      onSave();
    });
  }

  return (
    <div className="space-y-2 px-2 py-1.5 bg-muted/30 rounded">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <div className="flex gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="w-5 h-5 rounded-full transition-all shrink-0"
            style={{
              backgroundColor: c,
              outline: c === color ? "2px solid currentColor" : "none",
              outlineOffset: "2px",
            }}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="default" className="h-6 text-xs" onClick={handleSave} disabled={isPending}>
          Save
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CreateTagRow({
  name,
  existingCount,
  onCreate,
  disabled,
}: {
  name: string;
  existingCount: number;
  onCreate: (color: string) => void;
  disabled: boolean;
}) {
  const defaultColor = PRESET_COLORS[existingCount % PRESET_COLORS.length];
  const [selectedColor, setSelectedColor] = useState(defaultColor);

  return (
    <div className="border-t pt-2 space-y-2">
      <button
        type="button"
        onClick={() => onCreate(selectedColor)}
        disabled={disabled}
        className="flex items-center gap-2 w-full rounded px-2 py-1.5 hover:bg-muted/50 text-left"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        <span className="text-sm">
          Create &ldquo;<span className="font-medium">{name}</span>&rdquo;
        </span>
      </button>
      <div className="flex gap-1 px-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedColor(c)}
            className="w-5 h-5 rounded-full transition-all shrink-0"
            style={{
              backgroundColor: c,
              outline: c === selectedColor ? "2px solid currentColor" : "none",
              outlineOffset: "2px",
            }}
          />
        ))}
      </div>
    </div>
  );
}
