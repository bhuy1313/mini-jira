import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Panel({
  className,
  padded = true,
  children,
}: {
  className?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-rule bg-panel",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}