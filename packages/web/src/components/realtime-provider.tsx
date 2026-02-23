"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export function RealtimeProvider() {
  useRealtimeRefresh();
  return null; // Invisible — just activates the hook
}
