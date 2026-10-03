"use client";

import { useEffect, useRef } from "react";

/** Lightweight polling loop with pause-on-tab-hide and clean teardown. */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      if (!document.hidden) {
        try {
          await saved.current();
        } catch {
          /* polling errors are surfaced by callers via state */
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, enabled]);
}
