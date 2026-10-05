import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-ink active:bg-primary-deep disabled:opacity-50 disabled:hover:bg-primary",
  secondary:
    "border border-rule-strong bg-panel text-ink hover:bg-primary-soft hover:border-primary/30 active:bg-primary-soft2 disabled:opacity-50",
  ghost:
    "text-ink-soft hover:bg-primary-soft hover:text-primary-ink disabled:opacity-50",
  danger:
    "border border-rule-strong text-danger hover:border-danger/40 hover:bg-danger-soft disabled:opacity-50",
  "danger-solid":
    "bg-danger text-white hover:bg-[#b91c1c] active:bg-[#991b1b] disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
  md: "h-9 gap-2 rounded-md px-4 text-sm",
  lg: "h-11 gap-2 rounded-md px-5 text-sm",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}