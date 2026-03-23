"use client";

import { useState, useCallback, useEffect } from "react";
import type { Region } from "./types";

interface RegionSelectorProps {
  screenshotDataUrl: string;
  onRegionSelected: (region: Region, croppedImage: string) => void;
  onCancel: () => void;
  onFullScreen?: () => void;
}

export function RegionSelector({ screenshotDataUrl, onRegionSelected, onCancel, onFullScreen }: RegionSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  const getRegion = useCallback((): Region => {
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);
    return { x, y, width, height };
  }, [startPos, currentPos]);

  const getEventPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getEventPosition(e);
    setIsSelecting(true);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSelecting) return;
    e.preventDefault();
    const pos = getEventPosition(e);
    setCurrentPos(pos);
  };

  const handleEnd = useCallback(() => {
    if (!isSelecting) return;
    setIsSelecting(false);

    const region = getRegion();

    if (region.width < 20 || region.height < 20) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;

      canvas.width = region.width * dpr;
      canvas.height = region.height * dpr;

      ctx.drawImage(
        img,
        region.x * dpr,
        region.y * dpr,
        region.width * dpr,
        region.height * dpr,
        0,
        0,
        region.width * dpr,
        region.height * dpr
      );

      const croppedDataUrl = canvas.toDataURL("image/png");
      onRegionSelected(region, croppedDataUrl);
    };
    img.src = screenshotDataUrl;
  }, [isSelecting, getRegion, screenshotDataUrl, onRegionSelected]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const region = getRegion();

  return (
    <div
      className="fixed inset-0 z-[9999] cursor-crosshair touch-none"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      <img
        src={screenshotDataUrl}
        alt="Screenshot"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute bg-black/60 left-0 right-0 top-0"
          style={{ height: region.y }}
        />
        <div
          className="absolute bg-black/60 left-0 right-0 bottom-0"
          style={{ top: region.y + region.height }}
        />
        <div
          className="absolute bg-black/60 left-0"
          style={{
            top: region.y,
            height: region.height,
            width: region.x,
          }}
        />
        <div
          className="absolute bg-black/60 right-0"
          style={{
            top: region.y,
            height: region.height,
            left: region.x + region.width,
          }}
        />
      </div>

      {isSelecting && region.width > 0 && region.height > 0 && (
        <div
          className="absolute border-2 border-primary border-dashed pointer-events-none"
          style={{
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
          }}
        />
      )}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm text-center flex items-center gap-3">
        <span className="block sm:inline">Drag to select area</span>
        <span className="hidden sm:inline"> &bull; Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded">ESC</kbd> to cancel</span>
        {onFullScreen && (
          <>
            <span className="hidden sm:inline">&bull;</span>
            <button
              onClick={(e) => { e.stopPropagation(); onFullScreen(); }}
              className="underline underline-offset-2 hover:text-primary transition-colors whitespace-nowrap"
            >
              Use full screen
            </button>
          </>
        )}
      </div>

      <div className="absolute top-4 right-4 sm:hidden flex gap-2">
        {onFullScreen && (
          <button
            onClick={(e) => { e.stopPropagation(); onFullScreen(); }}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm"
          >
            Full screen
          </button>
        )}
        <button
          onClick={onCancel}
          className="bg-black/80 text-white px-3 py-1.5 rounded-lg text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
