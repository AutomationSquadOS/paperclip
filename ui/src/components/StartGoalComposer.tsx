import { useState, type FormEvent, type KeyboardEvent } from "react";
import { GOAL_HORIZONS, type GoalHorizon } from "@paperclipai/shared";
import { ArrowRight, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStartGoal } from "../hooks/useStartGoal";
import { GOAL_HORIZON_LABEL } from "../lib/goal-hierarchy";
import { cn } from "../lib/utils";

export function StartGoalComposer({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const [draft, setDraft] = useState("");
  const [horizon, setHorizon] = useState<GoalHorizon | null>(null);
  const { startGoal, isPending, lead } = useStartGoal();

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || isPending) return;
    startGoal({ title: draft, horizon }, { onSuccess: () => setDraft("") });
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3", className)} data-testid="start-goal-composer">
      <div className="rounded-2xl border bg-surface-raised shadow-md transition-shadow focus-within:border-ring/60 focus-within:shadow-lg focus-within:ring-4 focus-within:ring-ring/15">
        <label htmlFor="start-goal-input" className="sr-only">Describe a goal</label>
        <textarea
          id="start-goal-input"
          value={draft}
          autoFocus={autoFocus}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
          rows={2}
          placeholder="What do you want to achieve? e.g. Get our first 100 paying customers"
          className="block min-h-(--home-composer-min) w-full resize-none rounded-2xl bg-transparent px-5 pt-4 text-base text-foreground outline-none placeholder:text-muted-foreground/80"
        />
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <span className="text-xs font-medium text-muted-foreground">When</span>
          {GOAL_HORIZONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={horizon === option}
              onClick={() => setHorizon(horizon === option ? null : option)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                horizon === option
                  ? "border-ring/40 bg-brand-soft text-brand-soft-foreground"
                  : "bg-card/80 text-foreground/80 hover:border-ring/40",
              )}
            >
              {GOAL_HORIZON_LABEL[option]}
            </button>
          ))}
          <Button type="submit" className="ml-auto rounded-full px-5" disabled={!draft.trim() || isPending}>
            <Target className="h-4 w-4" />
            {isPending ? "Setting goal…" : "Set goal"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {lead
          ? `${lead.name} will draft the projects, tasks, hires, and budget, then ask for your OK before anything starts.`
          : "Hire a lead agent and they'll plan the projects, tasks, hires, and budget for this goal."}
      </p>
    </form>
  );
}
