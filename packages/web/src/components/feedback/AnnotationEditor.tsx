"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { AnnotationTool, Annotation, Point, MarkerAnnotation, ArrowAnnotation, TextAnnotation } from "./types";
import { AnnotationToolbar } from "./AnnotationToolbar";

interface AnnotationEditorProps {
  imageDataUrl: string;
  onAnnotatedImage: (dataUrl: string) => void;
}

const ANNOTATION_COLOR = "#EF4444";
const MARKER_WIDTH = 4;
const ARROW_HEAD_SIZE = 12;

export function AnnotationEditor({ imageDataUrl, onAnnotatedImage }: AnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("marker");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState<{ canvasPosition: Point; inputPosition: Point; visible: boolean }>({
    canvasPosition: { x: 0, y: 0 },
    inputPosition: { x: 0, y: 0 },
    visible: false,
  });
  const [textValue, setTextValue] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxWidth = container.clientWidth;
      const maxHeight = 400;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      const newScale = Math.min(scaleX, scaleY, 1);

      const displayWidth = img.width * newScale;
      const displayHeight = img.height * newScale;

      canvas.width = displayWidth;
      canvas.height = displayHeight;

      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const annotation of annotations) {
        drawAnnotation(ctx, annotation);
      }

      if (isDrawing && activeTool === "marker" && currentPoints.length > 0) {
        drawMarkerPath(ctx, currentPoints);
      }
      if (isDrawing && activeTool === "arrow" && startPoint && currentPoints.length > 0) {
        drawArrow(ctx, startPoint, currentPoints[currentPoints.length - 1]);
      }

      onAnnotatedImage(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, annotations, isDrawing, activeTool, currentPoints, startPoint, onAnnotatedImage]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    switch (annotation.type) {
      case "marker":
        drawMarkerPath(ctx, annotation.points);
        break;
      case "arrow":
        drawArrow(ctx, annotation.start, annotation.end);
        break;
      case "text":
        drawText(ctx, annotation.position, annotation.text);
        break;
    }
  };

  const drawMarkerPath = (ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.lineWidth = MARKER_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.8;

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    ctx.beginPath();
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.fillStyle = ANNOTATION_COLOR;
    ctx.lineWidth = 3;

    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - ARROW_HEAD_SIZE * Math.cos(angle - Math.PI / 6),
      end.y - ARROW_HEAD_SIZE * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      end.x - ARROW_HEAD_SIZE * Math.cos(angle + Math.PI / 6),
      end.y - ARROW_HEAD_SIZE * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  const drawText = (ctx: CanvasRenderingContext2D, position: Point, text: string) => {
    ctx.font = "bold 14px sans-serif";
    const metrics = ctx.measureText(text);
    const padding = 4;

    ctx.fillStyle = "white";
    ctx.fillRect(
      position.x - padding,
      position.y - 14 - padding,
      metrics.width + padding * 2,
      18 + padding * 2
    );

    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      position.x - padding,
      position.y - 14 - padding,
      metrics.width + padding * 2,
      18 + padding * 2
    );

    ctx.fillStyle = ANNOTATION_COLOR;
    ctx.fillText(text, position.x, position.y);
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getTextInputPosition = (canvasPoint: Point): Point => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return canvasPoint;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return {
      x: canvasPoint.x + (canvasRect.left - containerRect.left),
      y: canvasPoint.y + (canvasRect.top - containerRect.top),
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvasPoint = getCanvasPoint(e);

    if (activeTool === "text") {
      const inputPos = getTextInputPosition(canvasPoint);
      setTextInput({
        canvasPosition: canvasPoint,
        inputPosition: inputPos,
        visible: true
      });
      setTextValue("");
      return;
    }

    setIsDrawing(true);
    setStartPoint(canvasPoint);
    setCurrentPoints([canvasPoint]);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getCanvasPoint(e);
    setCurrentPoints((prev) => [...prev, point]);
  };

  const handlePointerUp = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e) e.preventDefault();

    if (activeTool === "marker" && currentPoints.length > 1) {
      const newAnnotation: MarkerAnnotation = {
        type: "marker",
        points: [...currentPoints],
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setRedoStack([]);
    } else if (activeTool === "arrow" && startPoint && currentPoints.length > 0) {
      const endPoint = currentPoints[currentPoints.length - 1];
      const newAnnotation: ArrowAnnotation = {
        type: "arrow",
        start: startPoint,
        end: endPoint,
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setRedoStack([]);
    }

    setIsDrawing(false);
    setCurrentPoints([]);
    setStartPoint(null);
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      const newAnnotation: TextAnnotation = {
        type: "text",
        position: textInput.canvasPosition,
        text: textValue.trim(),
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      setRedoStack([]);
    }
    setTextInput({ ...textInput, visible: false });
    setTextValue("");
  };

  const handleUndo = useCallback(() => {
    setAnnotations((prev) => {
      if (prev.length === 0) return prev;
      setRedoStack((redoPrev) => [...redoPrev, [...prev]]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setAnnotations(restored);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    if (annotations.length === 0) return;
    setRedoStack((prev) => [...prev, [...annotations]]);
    setAnnotations([]);
  }, [annotations]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isCtrlOrMeta && !e.shiftKey && key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((isCtrlOrMeta && key === "y") || (isCtrlOrMeta && e.shiftKey && key === "z")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isCtrlOrMeta && e.shiftKey && key === "x") {
        e.preventDefault();
        handleClear();
        return;
      }

      if (isCtrlOrMeta) return;

      switch (key) {
        case "1":
        case "m":
          e.preventDefault();
          setActiveTool("marker");
          break;
        case "2":
        case "a":
          e.preventDefault();
          setActiveTool("arrow");
          break;
        case "3":
        case "t":
          e.preventDefault();
          setActiveTool("text");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleClear]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative bg-muted rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={() => handlePointerUp()}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className={`block mx-auto touch-none ${
            activeTool === "text" ? "cursor-text" : "cursor-crosshair"
          }`}
        />

        {textInput.visible && (
          <div
            className="absolute z-10 flex gap-1"
            style={{
              left: Math.min(textInput.inputPosition.x, (containerRef.current?.clientWidth || 200) - 160),
              top: textInput.inputPosition.y,
            }}
          >
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleTextSubmit();
                }
                if (e.key === "Escape") {
                  setTextInput({ ...textInput, visible: false });
                  setTextValue("");
                }
              }}
              autoFocus
              placeholder="Type label..."
              className="px-2 py-1 text-sm border-2 border-red-500 rounded bg-white text-red-500 font-bold outline-none min-w-[80px] max-w-[120px]"
            />
            <button
              type="button"
              onClick={handleTextSubmit}
              className="px-2 py-1 text-sm bg-red-500 text-white rounded font-medium"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <AnnotationToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        canUndo={annotations.length > 0}
        canRedo={redoStack.length > 0}
      />
    </div>
  );
}
