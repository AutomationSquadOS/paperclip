import { Paperclip } from "lucide-react";

export function AppLoading({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-background">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg motion-safe:animate-pulse">
        <Paperclip className="h-6 w-6" />
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
