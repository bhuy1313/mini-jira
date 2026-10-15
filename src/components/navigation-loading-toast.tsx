"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  notifyNavigationDone,
  notifyNavigationStart,
} from "@/lib/notify";
import { subscribeNavigation } from "@/lib/navigation-pending";

const FAILSAFE_MS = 10_000;

/**
 * Thay thế NavigationProgress (thanh top 3px) bằng toast loading duy nhất
 * (React Toastify). Kiểu vuông + progress bar cấu hình ở `app/layout.tsx`
 * (ToastContainer) và `app/globals.css`.
 */
export function NavigationLoadingToast() {
  const pathname = usePathname();
  const pendingRef = useRef(false);
  const failRef = useRef(0);

  useEffect(() => {
    if (pendingRef.current) {
      pendingRef.current = false;
      window.clearTimeout(failRef.current);
      notifyNavigationDone();
    }
  }, [pathname]);

  useEffect(() => {
    const start = () => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      notifyNavigationStart();
      window.clearTimeout(failRef.current);
      failRef.current = window.setTimeout(() => {
        pendingRef.current = false;
        notifyNavigationDone();
      }, FAILSAFE_MS);
    };

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
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
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
      window.clearTimeout(failRef.current);
      if (pendingRef.current) {
        pendingRef.current = false;
        notifyNavigationDone();
      }
    };
  }, []);

  return null;
}
