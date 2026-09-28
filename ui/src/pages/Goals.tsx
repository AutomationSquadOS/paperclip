import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, GoalOverview, GoalOverviewEntry } from "@paperclipai/shared";
import { AlertTriangle, CheckCircle2, ChevronRight, FolderOpen, Inbox, Plus, Target, TrendingUp } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StartGoalComposer } from "../components/StartGoalComposer";
import { StatusIcon } from "../components/StatusIcon";
import { AgentName, HierarchyRow, ProjectRow, WorkHealthPill, WorkProgressBar } from "../components/GoalProgress";
import { GOAL_HORIZON_LABEL, goalRoleLabel } from "../lib/goal-hierarchy";
import { queryKeys } from "../lib/queryKeys";
import { cn, issueUrl, projectUrl } from "../lib/utils";

const OPEN_TASK_STATUSES = "backlog,todo,in_progress,in_review,blocked";
const GOAL_STATUS_ORDER: Record<string, number> = { active: 0, planned: 1, achieved: 2, cancelled: 3 };

export function Goals() {
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Goals" }]);
  }, [setBreadcrumbs]);

  const { data: overview, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.overview(selectedCompanyId!),
    queryFn: () => goalsApi.overview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const agentById = useMemo(() => new Map((agents ?? []).map((agent) => [agent.id, agent])), [agents]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Target} message="Select a company to view goals." />;
  }
  if (isLoading) return <PageSkeleton variant="list" />;

  const topGoals = overview ? companyGoals(overview) : [];
  const quarterPriorities = overview ? quarterGoals(overview) : [];

  return (
    <div className="mx-auto flex w-full max-w-(--home-content-max) flex-col gap-6 animate-rise-in" data-testid="goals-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl text-foreground">Goals</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Company goals are this-year or long-term. This-quarter priorities sit under them. Projects move those priorities, and tasks do the work.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => openNewGoal()}>
          <Plus className="h-3.5 w-3.5" />
          Add goal manually
        </Button>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-xs md:p-6">
        <h2 className="mb-3 text-base font-semibold">Start with a brief</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Goals stay short and measurable. Paste a long idea here and we'll draft the company goal and this-quarter priorities.
        </p>
        <StartGoalComposer />
      </section>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      {overview ? <WeeklySummary overview={overview} /> : null}

      {topGoals.length === 0 && quarterPriorities.length === 0 ? (
        <EmptyState icon={Target} message="No goals yet. Paste a brief above, or type a short company goal." />
      ) : (
        <div className="flex flex-col gap-6">
          {quarterPriorities.length > 0 ? (
            <section className="flex flex-col gap-3" data-testid="goals-this-quarter">
              <div>
                <h2 className="text-base font-semibold">This quarter</h2>
                <p className="text-sm text-muted-foreground">Ninety-day priorities. Each one should finish this quarter and serve a company goal.</p>
              </div>
              <div className="flex flex-col gap-3">
                {quarterPriorities.map((entry) => (
                  <GoalCard key={entry.goal.id} entry={entry} overview={overview!} agentById={agentById} compact />
                ))}
              </div>
            </section>
          ) : null}
          {topGoals.length > 0 ? (
            <section className="flex flex-col gap-3" data-testid="goals-company">
              <div>
                <h2 className="text-base font-semibold">Company goals</h2>
                <p className="text-sm text-muted-foreground">This year or long-term. Keep them concise and measurable.</p>
              </div>
              <div className="flex flex-col gap-4">
                {topGoals.map((entry) => (
                  <GoalCard key={entry.goal.id} entry={entry} overview={overview!} agentById={agentById} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {overview ? <UnplannedCard overview={overview} companyId={selectedCompanyId} /> : null}
    </div>
  );
}

function sortGoals(entries: GoalOverviewEntry[]) {
  return [...entries].sort(
    (a, b) =>
      (GOAL_STATUS_ORDER[a.goal.status] ?? 9) - (GOAL_STATUS_ORDER[b.goal.status] ?? 9) ||
      new Date(a.goal.createdAt).getTime() - new Date(b.goal.createdAt).getTime(),
  );
}

function companyGoals(overview: GoalOverview) {
  const ids = new Set(overview.goals.map((entry) => entry.goal.id));
  return sortGoals(
    overview.goals.filter(
      (entry) =>
        entry.goal.horizon !== "quarter" &&
        (!entry.goal.parentId || !ids.has(entry.goal.parentId)),
    ),
  );
}

function quarterGoals(overview: GoalOverview) {
  return sortGoals(overview.goals.filter((entry) => entry.goal.horizon === "quarter"));
}

function WeeklySummary({ overview }: { overview: GoalOverview }) {
  const { summary } = overview;
  const stats: { label: string; value: number; icon: typeof Target; tone: string }[] = [
    { label: "Finished this week", value: summary.completedLast7Days, icon: CheckCircle2, tone: "bg-tint-mint text-tint-mint-foreground" },
    { label: "New tasks this week", value: summary.createdLast7Days, icon: TrendingUp, tone: "bg-tint-sky text-tint-sky-foreground" },
    { label: "Stuck tasks", value: summary.blocked, icon: AlertTriangle, tone: "bg-tint-rose text-tint-rose-foreground" },
    { label: "Goals at risk", value: summary.goalsAtRisk, icon: Target, tone: "bg-tint-peach text-tint-peach-foreground" },
  ];
  return (
    <section aria-label="This week" className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="goals-weekly-summary">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", stat.tone)}>
            <stat.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
            <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function GoalCard({
  entry,
  overview,
  agentById,
  compact = false,
}: {
  entry: GoalOverviewEntry;
  overview: GoalOverview;
  agentById: Map<string, Agent>;
  compact?: boolean;
}) {
  const projectById = new Map(overview.projects.map((project) => [project.id, project]));
  const goalById = new Map(overview.goals.map((goal) => [goal.goal.id, goal]));
  const projects = entry.projectIds.flatMap((id) => projectById.get(id) ?? []);
  const children = compact ? [] : entry.childGoalIds.flatMap((id) => goalById.get(id) ?? []);
  const { goal } = entry;
  return (
    <article className="rounded-2xl border bg-card shadow-xs" data-testid="goal-card">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-soft-foreground">
            {goalRoleLabel(goal.horizon)}
          </span>
          {goal.horizon ? (
            <span className="text-xs text-muted-foreground">
              {GOAL_HORIZON_LABEL[goal.horizon]}
            </span>
          ) : null}
          <WorkHealthPill progress={entry.progress} />
          {goal.status === "planned" ? <span className="text-xs text-muted-foreground">Not started yet</span> : null}
          <span className="ml-auto">
            <AgentName agentId={goal.ownerAgentId} agentById={agentById} prefix="Owner" />
          </span>
        </div>
        <Link to={`/goals/${goal.id}`} className="group flex min-w-0 items-center gap-2 text-inherit no-underline">
          <h2 className="line-clamp-3 min-w-0 text-lg font-semibold group-hover:underline">{goal.title}</h2>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
        </Link>
        <WorkProgressBar progress={entry.progress} />
      </div>
      {projects.length > 0 || children.length > 0 || entry.tasksWithoutProject > 0 ? (
        <div className="flex flex-col border-t px-3 py-2">
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} agentById={agentById} />
          ))}
          {children.map((child) => (
            <HierarchyRow
              key={child.goal.id}
              to={`/goals/${child.goal.id}`}
              icon={<Target className="h-4 w-4" />}
              iconClass="bg-brand-soft text-brand-soft-foreground"
              title={child.goal.title}
              subtitle={goalRoleLabel(child.goal.horizon)}
              progress={child.progress}
            />
          ))}
          {entry.tasksWithoutProject > 0 ? (
            <Link to={`/goals/${goal.id}`} className="px-2 py-2 text-xs text-muted-foreground no-underline hover:text-foreground">
              + {entry.tasksWithoutProject} task{entry.tasksWithoutProject === 1 ? "" : "s"} on this goal not in a project yet
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          No projects yet. The goal owner will propose them in a plan for your OK.
        </p>
      )}
    </article>
  );
}

function UnplannedCard({ overview, companyId }: { overview: GoalOverview; companyId: string }) {
  const open = overview.unplanned.total - overview.unplanned.done - overview.unplanned.cancelled;
  const { data: tasks } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "without-project"],
    queryFn: () => issuesApi.list(companyId, { withoutProject: true, status: OPEN_TASK_STATUSES, limit: 5, sortField: "updated", sortDir: "desc" }),
    enabled: open > 0,
  });
  const projectsWithoutGoal = overview.projects.filter((project) => overview.projectsWithoutGoal.includes(project.id));
  if (open <= 0 && projectsWithoutGoal.length === 0) return null;
  return (
    <section className="rounded-2xl border border-dashed bg-card/60 p-5" data-testid="goals-unplanned">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Inbox className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Not in a project yet</h2>
          <p className="text-xs text-muted-foreground">
            {open} open task{open === 1 ? "" : "s"} without a project. Open one and pick a project so it counts toward a goal.
          </p>
        </div>
      </div>
      <div className="flex flex-col">
        {(tasks ?? []).map((issue) => (
          <Link
            key={issue.id}
            to={issueUrl(issue)}
            className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-inherit no-underline hover:bg-accent"
          >
            <StatusIcon status={issue.status} />
            <span className="truncate">{issue.title}</span>
          </Link>
        ))}
        {projectsWithoutGoal.map((project) => (
          <Link
            key={project.id}
            to={projectUrl({ id: project.id, urlKey: project.urlKey, name: project.name })}
            className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-inherit no-underline hover:bg-accent"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{project.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">Project with no goal</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
