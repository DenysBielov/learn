export type Tag = { id: number; name: string; color: string | null };

export const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
] as const;

/**
 * Compute text color for a given background hex using WCAG 2.0 relative luminance
 * with proper sRGB gamma decoding.
 */
export function getContrastColor(hex: string | null): "white" | "hsl(0 0% 13%)" {
  if (!hex || hex.length < 7) return "white";

  const rsRGB = parseInt(hex.slice(1, 3), 16) / 255;
  const gsRGB = parseInt(hex.slice(3, 5), 16) / 255;
  const bsRGB = parseInt(hex.slice(5, 7), 16) / 255;

  const r = rsRGB <= 0.04045 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.04045 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.04045 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "hsl(0 0% 13%)" : "white";
}

/**
 * Parse comma-separated tag IDs from a URL search param.
 * Returns only valid positive integers, silently dropping invalid values.
 */
export function parseTagIdsFromUrl(param: string | undefined): number[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && Number.isInteger(n));
}
