"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 500;

/**
 * Hook that connects to the SSE event stream and debounces router.refresh()
 * calls to update server-rendered content when MCP tools make changes.
 *
 * Flow: MCP mutation -> emitEvent -> events table -> SSE poll ->
 *       stream to browser -> EventSource.onmessage -> debounce -> router.refresh()
 */
export function useRealtimeRefresh() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 30000;

    function scheduleRefresh() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        router.refresh();
        debounceRef.current = null;
      }, DEBOUNCE_MS);
    }

    function connect() {
      eventSource = new EventSource("/api/events/stream");

      eventSource.onopen = () => {
        reconnectDelay = 1000; // Reset delay on successful connection
      };

      // The SSE endpoint sends unnamed events (no `event:` field),
      // so onmessage fires for every event type.
      eventSource.onmessage = () => {
        scheduleRefresh();
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        // Reconnect with exponential backoff
        reconnectTimeout = setTimeout(() => {
          connect();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      };
    }

    connect();

    return () => {
      eventSource?.close();
      eventSource = null;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [router]);
}
