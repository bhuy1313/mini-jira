import { cn } from "@/lib/cn";
import { getWorkspaceIcon } from "@/features/workspaces/workspace-icons";

export interface WorkspaceAvatarProps {
  name: string;
  icon?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "size-5 text-[10px] rounded",
  sm: "size-7 text-xs rounded-lg",
  md: "size-9 text-sm rounded-xl",
  lg: "size-12 text-lg rounded-xl",
  xl: "size-16 text-2xl rounded-2xl",
};

const emojiSizeClasses = {
  xs: "text-[11px]",
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function WorkspaceAvatar({
  name,
  icon,
  size = "md",
  className,
}: WorkspaceAvatarProps) {
  const iconDef = getWorkspaceIcon(icon);
  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : "W";

  if (iconDef) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center bg-gradient-to-br border shadow-2xs select-none transition-transform",
          iconDef.bgGradient,
          sizeClasses[size],
          className,
        )}
      >
        <span className={cn("leading-none", emojiSizeClasses[size])}>
          {iconDef.emoji}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center bg-primary-soft font-bold text-primary-ink border border-primary/20 shadow-2xs select-none",
        sizeClasses[size],
        className,
      )}
    >
      {initial}
    </span>
  );
}
