import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  /** Optional bold heading rendered above the message. */
  title?: string;
  message: string;
  /** Optional secondary line rendered under the primary message. */
  description?: string;
  action?: string;
  onAction?: () => void;
  /** Hide the leading "+" glyph on the action button (e.g. for a "Set up" CTA). */
  hideActionIcon?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  description,
  action,
  onAction,
  hideActionIcon = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="relative mb-5 flex size-(--size-illustration) items-center justify-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-brand-soft opacity-60 blur-2xl" />
        <span className="relative flex size-16 items-center justify-center rounded-2xl border bg-card text-brand-soft-foreground shadow-md">
          <Icon className="h-7 w-7" />
        </span>
      </div>
      {title ? (
        <>
          <p className="text-lg font-semibold text-foreground mb-1.5">{title}</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-md">{message}</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-foreground mb-1">{message}</p>
          {description && <p className="max-w-md text-sm text-muted-foreground mb-5">{description}</p>}
        </>
      )}
      {action && onAction && (
        <Button onClick={onAction} className="rounded-full px-5">
          {!hideActionIcon && <Plus className="h-4 w-4 mr-1.5" />}
          {action}
        </Button>
      )}
    </div>
  );
}
