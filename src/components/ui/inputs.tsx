import { cn } from "@/lib/cn";

const CONTROL_BASE =
  "w-full rounded-md border border-rule-strong bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-primary/40 focus:border-primary-ink focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({
  className,
  ...props
}: React.ComponentPropsWithRef<"input">) {
  return <input className={cn(CONTROL_BASE, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(CONTROL_BASE, "resize-y leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"select">) {
  return (
    <select className={cn(CONTROL_BASE, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}