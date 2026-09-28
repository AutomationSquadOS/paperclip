import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, GoalOverviewProject, Issue, WorkProgress } from "@paperclipai/shared";
import { ChevronRight, FolderOpen, Target } from "lucide-react";
import { goalsApi } from "../api/goals";
import { queryKeys } from "../lib/queryKeys";
import { Link } from "@/lib/router";
import { cn, projectUrl } from "../lib/utils";
import { WORK_HEALTH_BAR, WORK_HEALTH_LABEL, WORK_HEALTH_TONE } from "../lib/goal-hierarchy";

export function WorkHealthPill({ progress, className }: { progress: WorkProgress; className?: string }) {
  return (
    <span
      data-testid="work-health"
      className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", WORK_HEALTH_TONE[progress.health], className)}
    >
      {WORK_HEALTH_LABEL[progress.health]}
    </span>
  );
}

export function WorkProgressBar({
  progress,
  size = "md",
  showLabel = true,
  className,
}: {
  progress: WorkProgress;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const countable = progress.total - progress.cancelled;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percentComplete}
        aria-label={`${progress.percentComplete}% complete`}
        className={cn("flex-1 overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2")}
      >
        <div
          className={cn("h-full rounded-full transition-all", WORK_HEALTH_BAR[progress.health])}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      {showLabel ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {countable > 0 ? `${progress.done} of ${countable} done` : "No tasks yet"}
        </span>
      ) : null}
    </div>
  );
}

export function AgentName({ agentId, agentById, prefix }: { agentId: string | null; agentById: Map<string, Agent>; prefix: string }) {
  const agent = agentId ? agentById.get(agentId) : null;
  if (!agent) return null;
  return (
    <span className="truncate text-xs text-muted-foreground">
      {prefix} <span className="font-medium text-foreground/80">{agent.name}</span>
    </span>
  );
}

export function ProjectRow({ project, agentById }: { project: GoalOverviewProject; agentById: Map<string, Agent> }) {
  const lead = project.leadAgentId ? agentById.get(project.leadAgentId) : null;
  const helpers = project.assigneeAgentIds.filter((id) => id !== project.leadAgentId).length;
  const subtitle = [lead ? `Led by ${lead.name}` : "No lead yet", helpers > 0 ? `+${helpers} agent${helpers === 1 ? "" : "s"}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <HierarchyRow
      to={projectUrl({ id: project.id, urlKey: project.urlKey, name: project.name })}
      icon={<FolderOpen className="h-4 w-4" />}
      iconClass="bg-tint-sky text-tint-sky-foreground"
      title={project.name}
      subtitle={subtitle}
      progress={project.progress}
    />
  );
}

export function HierarchyRow({
  to,
  icon,
  iconClass,
  title,
  subtitle,
  progress,
}: {
  to: string;
  icon: ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  progress: GoalOverviewProject["progress"];
}) {
  return (
    <Link
      to={to}
      className="group grid grid-cols-1 items-center gap-2 rounded-xl px-2 py-2.5 text-sm text-inherit no-underline transition-colors hover:bg-accent md:grid-cols-2"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconClass)}>{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <WorkProgressBar progress={progress} size="sm" className="flex-1" />
        <WorkHealthPill progress={progress} />
      </span>
    </Link>
  );
}


export function ProjectGoalProgress({ companyId, projectId }: { companyId: string | null | undefined; projectId: string }) {
  const { data: overview } = useQuery({
    queryKey: queryKeys.goals.overview(companyId!),
    queryFn: () => goalsApi.overview(companyId!),
    enabled: !!companyId,
  });
  const project = overview?.projects.find((entry) => entry.id === projectId);
  if (!overview || !project) return null;
  const goalById = new Map(overview.goals.map((entry) => [entry.goal.id, entry.goal]));
  const linkedGoals = project.goalIds.flatMap((id) => goalById.get(id) ?? []);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs" data-testid="project-goal-progress">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Target className="h-4 w-4 text-brand" />
        {linkedGoals.length > 0 ? (
          <>
            <span className="text-muted-foreground">Moves goal</span>
            {linkedGoals.map((goal) => (
              <Link key={goal.id} to={`/goals/${goal.id}`} className="font-medium text-foreground hover:underline">
                {goal.title}
              </Link>
            ))}
          </>
        ) : (
          <span className="text-muted-foreground">Not linked to a goal yet. Pick one in the project properties.</span>
        )}
        <WorkHealthPill progress={project.progress} className="ml-auto" />
      </div>
      <WorkProgressBar progress={project.progress} />
    </section>
  );
}

type WorkPathIssue = Pick<Issue, "title" | "goalId" | "projectId"> & {
  goal?: { id: string; title: string } | null;
  project?: { id: string; name: string; urlKey?: string | null } | null;
};

/** Goal › Project breadcrumb for a task, so every task shows what it moves forward. */
export function WorkPath({ issue }: { issue: WorkPathIssue }) {
  const goal = issue.goal ?? null;
  const project = issue.project ?? null;
  return (
    <nav aria-label="Work path" data-testid="work-path" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Target className="h-3.5 w-3.5 shrink-0 text-brand" />
      {goal ? (
        <Link to={`/goals/${goal.id}`} className="max-w-(--sz-200px) truncate hover:text-foreground" title={goal.title}>
          {goal.title}
        </Link>
      ) : (
        <span>No goal</span>
      )}
      <ChevronRight className="h-3 w-3 shrink-0" />
      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
      {project ? (
        <Link to={projectUrl(project)} className="max-w-(--sz-200px) truncate hover:text-foreground" title={project.name}>
          {project.name}
        </Link>
      ) : (
        <span className="rounded-full bg-muted px-2 py-0.5">Not in a project yet</span>
      )}
    </nav>
  );
}
