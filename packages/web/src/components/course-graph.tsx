"use client";

import { useMemo, useRef, useState } from "react";
import { GraphNode } from "@/components/graph-node";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Step {
  id: number;
  position: number;
  stepType: "material" | "quiz";
  materialId: number | null;
  quizId: number | null;
  title: string;
  isCompleted: boolean;
}

interface Edge {
  fromStepId: number;
  toStepId: number;
}

interface CourseGraphProps {
  steps: Step[];
  edges: Edge[];
}

const NODE_W = 180;
const NODE_H = 70;
const GAP_X = 60;
const GAP_Y = 40;
const PAD = 40;

export function CourseGraph({ steps, edges }: CourseGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Layout: topological sort by dependency depth
  const { positions, width, height } = useMemo(() => {
    // Build adjacency (edge.toStepId depends on edge.fromStepId)
    const inDegree = new Map<number, number>();
    const adj = new Map<number, number[]>();

    for (const step of steps) {
      inDegree.set(step.id, 0);
      adj.set(step.id, []);
    }

    for (const edge of edges) {
      adj.get(edge.fromStepId)?.push(edge.toStepId);
      inDegree.set(edge.toStepId, (inDegree.get(edge.toStepId) ?? 0) + 1);
    }

    // BFS topological sort to determine depth (column)
    const depth = new Map<number, number>();
    const queue: number[] = [];

    for (const step of steps) {
      if ((inDegree.get(step.id) ?? 0) === 0) {
        queue.push(step.id);
        depth.set(step.id, 0);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      const d = depth.get(node) ?? 0;
      for (const next of (adj.get(node) ?? [])) {
        const newDepth = d + 1;
        depth.set(next, Math.max(depth.get(next) ?? 0, newDepth));
        inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
        if (inDegree.get(next) === 0) queue.push(next);
      }
    }

    // Assign nodes with no edges to position by their original order
    for (const step of steps) {
      if (!depth.has(step.id)) depth.set(step.id, step.position);
    }

    // Group by depth
    const columns = new Map<number, number[]>();
    for (const step of steps) {
      const d = depth.get(step.id) ?? 0;
      if (!columns.has(d)) columns.set(d, []);
      columns.get(d)!.push(step.id);
    }

    const maxCol = Math.max(...Array.from(columns.keys()), 0);
    const maxRowSize = Math.max(...Array.from(columns.values()).map(v => v.length), 1);

    const pos = new Map<number, { x: number; y: number }>();
    for (const [col, ids] of columns) {
      ids.forEach((id, row) => {
        pos.set(id, {
          x: PAD + col * (NODE_W + GAP_X),
          y: PAD + row * (NODE_H + GAP_Y),
        });
      });
    }

    return {
      positions: pos,
      width: PAD * 2 + (maxCol + 1) * (NODE_W + GAP_X) - GAP_X,
      height: PAD * 2 + maxRowSize * (NODE_H + GAP_Y) - GAP_Y,
    };
  }, [steps, edges]);

  // Determine node statuses
  const firstIncomplete = steps.find(s => !s.isCompleted);
  const lockedIds = useMemo(() => {
    const locked = new Set<number>();
    for (const edge of edges) {
      const prereq = steps.find(s => s.id === edge.fromStepId);
      if (prereq && !prereq.isCompleted) {
        locked.add(edge.toStepId);
      }
    }
    return locked;
  }, [steps, edges]);

  function getStatus(step: Step): "completed" | "current" | "pending" | "locked" {
    if (step.isCompleted) return "completed";
    if (lockedIds.has(step.id)) return "locked";
    if (step.id === firstIncomplete?.id) return "current";
    return "pending";
  }

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        No steps to display
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
          className="p-1.5 border rounded-md hover:bg-[var(--card-hover)] transition-colors"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))}
          className="p-1.5 border rounded-md hover:bg-[var(--card-hover)] transition-colors"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1.5 border rounded-md hover:bg-[var(--card-hover)] transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="text-xs text-muted-foreground ml-2">{Math.round(zoom * 100)}%</div>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-green-500/30 bg-green-500/10" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-blue-500/30 bg-blue-500/10" /> Current</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border bg-card" /> Pending</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border opacity-50" /> Locked</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="border rounded-[10px] overflow-auto bg-[var(--panel-bg)]"
        style={{ height: "calc(100vh - 300px)", minHeight: "400px" }}
      >
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", position: "relative", width, height }}>
          {/* SVG edges */}
          <svg className="absolute inset-0" style={{ width, height }} xmlns="http://www.w3.org/2000/svg">
            {edges.map((edge, i) => {
              const from = positions.get(edge.fromStepId);
              const to = positions.get(edge.toStepId);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  stroke="var(--border)"
                  strokeWidth={1.5}
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {steps.map((step) => {
            const pos = positions.get(step.id);
            if (!pos) return null;
            return (
              <GraphNode
                key={step.id}
                title={step.title}
                stepType={step.stepType}
                status={getStatus(step)}
                x={pos.x}
                y={pos.y}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
