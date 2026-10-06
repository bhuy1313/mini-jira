"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationLoadingIndicator() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      setIsNavigating(true);
      prevPathname.current = pathname;
      const timer = setTimeout(() => setIsNavigating(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm text-primary animate-in fade-in slide-in-from-bottom-2">
      <svg className="size-4 animate-spin" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
      </svg>
      <span>Đang tải dữ liệu workspace...</span>
    </div>
  );
}
