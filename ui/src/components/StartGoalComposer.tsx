import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { GOAL_HORIZONS, isLongBrief, type GoalHorizon, type GoalIntakeKind } from "@paperclipai/shared";
import { ArrowRight, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStartGoal } from "../hooks/useStartGoal";
import { GOAL_HORIZON_LABEL } from "../lib/goal-hierarchy";
import { cn } from "../lib/utils";

const BRIEF_HORIZONS = GOAL_HORIZONS.filter((horizon) => horizon !== "quarter");

export function StartGoalComposer({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<GoalIntakeKind>("brief");
  const [horizon, setHorizon] = useState<GoalHorizon | null>(null);
  const { startGoal, isPending, lead } = useStartGoal();
  const asBrief = mode === "brief" || isLongBrief(draft);

  useEffect(() => {
    if (mode === "goal" && isLongBrief(draft)) setMode("brief");
  }, [draft, mode]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || isPending) return;
    startGoal(
      { title: draft, horizon, kind: asBrief ? "brief" : "goal" },
      { onSuccess: () => setDraft("") },
    );
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (asBrief && !event.metaKey && !event.ctrlKey) return;
    submit(event);
  }

  const horizons = asBrief ? BRIEF_HORIZONS : GOAL_HORIZONS;

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3", className)} data-testid="start-goal-composer">
      <div className="rounded-2xl border bg-surface-raised shadow-md transition-shadow focus-within:border-ring/60 focus-within:shadow-lg focus-within:ring-4 focus-within:ring-ring/15">
        <div role="tablist" aria-label="Start with a brief or a short goal" className="flex gap-1 px-4 pt-3">
          {([
            { id: "brief" as const, label: "Brief", icon: FileText },
            { id: "goal" as const, label: "Goal", icon: Target },
          ]).map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={mode === option.id}
              onClick={() => setMode(option.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                mode === option.id ? "bg-brand-soft text-brand-soft-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          ))}
        </div>
        <label htmlFor="start-goal-input" className="sr-only">
          {asBrief ? "Paste a brief" : "Describe a short goal"}
        </label>
        <textarea
          id="start-goal-input"
          value={draft}
          autoFocus={autoFocus}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
          rows={asBrief ? 6 : 2}
          placeholder={
            asBrief
              ? "Paste the whole idea. We'll make a short company goal, this-quarter priorities, and a plan for your OK."
              : "Short and measurable. e.g. Get our first 100 paying customers"
          }
          className="block min-h-(--home-composer-min) w-full resize-none rounded-2xl bg-transparent px-5 pt-4 text-base text-foreground outline-none placeholder:text-muted-foreground/80"
        />
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <span className="text-xs font-medium text-muted-foreground">{asBrief ? "Company goal" : "When"}</span>
          {horizons.map((option) => (
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
            {asBrief ? <FileText className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            {isPending ? "Starting…" : asBrief ? "Start from brief" : "Set goal"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {asBrief
          ? lead
            ? `${lead.name} will turn this into a short company goal, this-quarter priorities, projects, and checkpoints, then ask for your OK.`
            : "Hire a lead agent and they'll turn this brief into a company goal, this-quarter priorities, and a plan."
          : "Goals stay short and measurable. Long ideas belong in a brief."}
      </p>
    </form>
  );
}
