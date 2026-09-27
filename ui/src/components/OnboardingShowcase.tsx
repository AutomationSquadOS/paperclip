import type { ReactNode } from "react";
import { CheckCircle2, Crown, Paperclip, UserPlus } from "lucide-react";
import { cn } from "../lib/utils";

function PreviewCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border bg-card/90 p-4 shadow-lg backdrop-blur", className)}>
      {children}
    </div>
  );
}

/** Decorative right-hand panel for the onboarding wizard: a preview of what the team will look like. */
export function OnboardingShowcase() {
  return (
    <div aria-hidden="true" className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-background p-10">
      <div className="pointer-events-none absolute inset-0 bg-(image:--home-hero-glow)" />
      <div className="relative flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Paperclip className="h-4 w-4" />
        </span>
        Paperclip
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-col gap-4">
        <h2 className="font-display text-4xl leading-tight">Your AI team, ready in minutes.</h2>
        <PreviewCard className="animate-rise-in">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-soft-foreground">
              <Crown className="h-4 w-4" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-status-running" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Ava</p>
              <p className="text-xs text-muted-foreground">Chief of staff</p>
            </div>
            <span className="ml-auto rounded-full bg-tint-sky px-2 py-0.5 text-xs font-medium text-tint-sky-foreground">Working now</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Drafting your launch plan…</p>
        </PreviewCard>
        <PreviewCard className="ml-8 animate-rise-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-tint-mint-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Research our top 5 competitors</p>
              <p className="text-xs text-muted-foreground">Done · ready for you to review</p>
            </div>
          </div>
        </PreviewCard>
        <PreviewCard className="animate-rise-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-tint-peach text-tint-peach-foreground">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Hire a Growth Marketer?</p>
              <p className="text-xs text-muted-foreground">Ava is asking for your OK</p>
            </div>
            <span className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Approve</span>
          </div>
        </PreviewCard>
      </div>

      <p className="relative text-sm text-muted-foreground">You stay in charge. Agents check with you before big decisions.</p>
    </div>
  );
}
