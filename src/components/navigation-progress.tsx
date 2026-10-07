"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribeNavigation } from "@/lib/navigation-pending";

type Phase = "idle" | "pending" | "fade";

const TICK_MS = 80;
const COMPLETE_DELAY = 250;
const FADE_DELAY = 200;
const FAILSAFE_MS = 10_000;

interface UiState {
  phase: Phase;
  visible: boolean;
  progress: number;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [ui, setUi] = useState<UiState>({
    phase: "idle",
    visible: false,
    progress: 0,
  });

  const phaseRef = useRef<Phase>("idle");
  const visibleRef = useRef(false);
  const timersRef = useRef({
    fail: 0,
    complete: 0,
    fade: 0,
    tick: 0,
  });

  const clearTimers = (...keys: (keyof typeof timersRef.current)[]) => {
    for (const key of keys) {
      window.clearTimeout(timersRef.current[key]);
      window.clearInterval(timersRef.current[key]);
      timersRef.current[key] = 0;
    }
  };

  const finish = () => {
    if (phaseRef.current !== "pending") return;
    clearTimers("fail", "tick");

    phaseRef.current = "fade";
    setUi((prev) => ({ ...prev, phase: "fade", progress: 1 }));
    timersRef.current.complete = window.setTimeout(() => {
      visibleRef.current = false;
      setUi((prev) => ({ ...prev, visible: false }));
      timersRef.current.fade = window.setTimeout(() => {
        phaseRef.current = "idle";
        setUi({ phase: "idle", visible: false, progress: 0 });
      }, FADE_DELAY);
    }, COMPLETE_DELAY);
  };

  const start = () => {
    if (phaseRef.current === "pending") return;

    if (phaseRef.current === "fade") {
      // New navigation during the completion fade: keep the bar on screen.
      clearTimers("complete", "fade");
      phaseRef.current = "pending";
      setUi((prev) => ({ ...prev, phase: "pending" }));
    } else {
      visibleRef.current = true;
      setUi({ phase: "pending", visible: true, progress: 0 });
      phaseRef.current = "pending";
    }

    timersRef.current.tick = window.setInterval(() => {
      setUi((prev) => ({
        ...prev,
        progress: Math.min(
          0.9,
          prev.progress + (0.9 - prev.progress) * 0.1 + 0.02,
        ),
      }));
    }, TICK_MS);

    timersRef.current.fail = window.setTimeout(() => finish(), FAILSAFE_MS);
  };

  // End signal: the router committed a new pathname.
  useEffect(() => {
    if (phaseRef.current === "pending") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Start signals: internal link clicks (capture) + back/forward.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same path (query/hash only) or the page already on screen: no navigation to wait for.
      if (url.pathname === window.location.pathname) return;

      start();
    };

    const onPopstate = () => start();
    const unsubscribe = subscribeNavigation(() => start());

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopstate);
    return () => {
      unsubscribe();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopstate);
      clearTimers("fail", "complete", "fade", "tick");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const announced = ui.phase === "pending" && ui.visible;

  return (
    <>
      <div role="status" aria-live="polite">
        {announced ? <span className="sr-only">Đang tải trang...</span> : null}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] transition-opacity duration-200 ${
          ui.visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full origin-left bg-primary transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${ui.progress})` }}
        />
      </div>
    </>
  );
}
