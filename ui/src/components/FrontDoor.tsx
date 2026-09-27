import { Rocket, Zap } from "lucide-react";
import { cn } from "../lib/utils";

interface FrontDoorProps {
  onChoose: (path: "create" | "grow") => void;
}

export function FrontDoor({ onChoose }: FrontDoorProps) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-dvh px-8 py-12 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--home-hero-glow)" />
      <div className="relative text-center mb-10 animate-rise-in">
        <h2 className="font-display text-5xl leading-tight">
          Welcome to Paperclip
        </h2>
        <p className="text-base text-muted-foreground mt-3 max-w-md">
          Build a team of AI agents that works for you. How would you like to get started?
        </p>
      </div>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full animate-rise-in">
        <button
          className={cn(
            "flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 shadow-sm",
            "hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-lg transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("create")}
        >
          <div className="rounded-2xl bg-brand-soft p-3.5 text-brand-soft-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Build a new company</h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              Begin with a mission, bring on a lead agent, and grow a team of agents to do the work.
            </p>
          </div>
        </button>

        <button
          className={cn(
            "flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 shadow-sm",
            "hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-lg transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("grow")}
        >
          <div className="rounded-2xl bg-brand-soft p-3.5 text-brand-soft-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Add agents to your org</h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              Bring AI agents into your existing team or workflows.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
