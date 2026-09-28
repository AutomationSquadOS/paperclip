import type { Agent, GoalHorizon, WorkHealth } from "@paperclipai/shared";

export const WORK_HEALTH_LABEL: Record<WorkHealth, string> = {
  not_started: "Not started",
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  done: "Done",
};

export const WORK_HEALTH_TONE: Record<WorkHealth, string> = {
  not_started: "bg-muted text-muted-foreground",
  on_track: "bg-tint-mint text-tint-mint-foreground",
  at_risk: "bg-tint-peach text-tint-peach-foreground",
  off_track: "bg-tint-rose text-tint-rose-foreground",
  done: "bg-tint-sky text-tint-sky-foreground",
};

export const WORK_HEALTH_BAR: Record<WorkHealth, string> = {
  not_started: "bg-muted-foreground/30",
  on_track: "bg-tint-mint-foreground",
  at_risk: "bg-tint-peach-foreground",
  off_track: "bg-tint-rose-foreground",
  done: "bg-tint-sky-foreground",
};

export const GOAL_HORIZON_LABEL: Record<GoalHorizon, string> = {
  long_term: "Long-term",
  year: "This year",
  quarter: "This quarter",
};

function isBuiltInAgent(agent: Agent) {
  const metadata = agent.metadata as Record<string, unknown> | null | undefined;
  return Boolean(metadata && metadata.paperclipBuiltInAgent);
}

/** The agent who plans new goals: the CEO, else the top of the org chart. */
export function pickCompanyLeadAgent(agents: Agent[] | null | undefined): Agent | null {
  const candidates = (agents ?? []).filter(
    (agent) => agent.status !== "terminated" && agent.status !== "pending_approval" && !isBuiltInAgent(agent),
  );
  return (
    candidates.find((agent) => agent.role === "ceo") ??
    candidates.find((agent) => !agent.reportsTo) ??
    candidates[0] ??
    null
  );
}
