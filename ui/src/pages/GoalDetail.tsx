import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { assetsApi } from "../api/assets";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { GoalProperties } from "../components/GoalProperties";
import { StatusBadge } from "../components/StatusBadge";
import { InlineEditor } from "../components/InlineEditor";
import { EntityRow } from "../components/EntityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn, issueUrl, projectUrl } from "../lib/utils";
import { AgentName, ProjectRow, WorkHealthPill, WorkProgressBar } from "../components/GoalProgress";
import { StatusIcon } from "../components/StatusIcon";
import { GOAL_HORIZON_LABEL, goalRoleLabel } from "../lib/goal-hierarchy";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, SlidersHorizontal } from "lucide-react";
import { GOAL_PLANNING_TASK_TITLE_PREFIX, type Goal, type Project } from "@paperclipai/shared";

interface GoalPropertiesToggleButtonProps {
  panelVisible: boolean;
  onShowProperties: () => void;
}

export function GoalPropertiesToggleButton({
  panelVisible,
  onShowProperties,
}: GoalPropertiesToggleButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn(
        "hidden md:inline-flex shrink-0 transition-opacity duration-200",
        panelVisible ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100",
      )}
      onClick={onShowProperties}
      title="Show properties"
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );
}

export function GoalDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { openNewGoal } = useDialogActions();
  const { openPanel, closePanel, panelVisible, setPanelVisible } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const {
    data: goal,
    isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.goals.detail(goalId!),
    queryFn: () => goalsApi.get(goalId!),
    enabled: !!goalId
  });
  const resolvedCompanyId = goal?.companyId ?? selectedCompanyId;

  const { data: allGoals } = useQuery({
    queryKey: queryKeys.goals.list(resolvedCompanyId!),
    queryFn: () => goalsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId
  });

  const { data: allProjects } = useQuery({
    queryKey: queryKeys.projects.list(resolvedCompanyId!, { includeArchived: true }),
    queryFn: () => projectsApi.list(resolvedCompanyId!, { includeArchived: true }),
    enabled: !!resolvedCompanyId
  });

  const { data: overview } = useQuery({
    queryKey: queryKeys.goals.overview(resolvedCompanyId!),
    queryFn: () => goalsApi.overview(resolvedCompanyId!),
    enabled: !!resolvedCompanyId
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId!),
    queryFn: () => agentsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId
  });

  const { data: goalTasks } = useQuery({
    queryKey: [...queryKeys.issues.list(resolvedCompanyId!), "goal", goalId],
    queryFn: () => issuesApi.list(resolvedCompanyId!, { goalId: goalId!, limit: 50, sortField: "updated", sortDir: "desc" }),
    enabled: !!resolvedCompanyId && !!goalId
  });

  useEffect(() => {
    if (!goal?.companyId || goal.companyId === selectedCompanyId) return;
    setSelectedCompanyId(goal.companyId, { source: "route_sync" });
  }, [goal?.companyId, selectedCompanyId, setSelectedCompanyId]);

  const updateGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      goalsApi.update(goalId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.goals.detail(goalId!)
      });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.goals.list(resolvedCompanyId)
        });
      }
    }
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedCompanyId) throw new Error("No company selected");
      return assetsApi.uploadImage(
        resolvedCompanyId,
        file,
        `goals/${goalId ?? "draft"}`
      );
    }
  });

  const childGoals = (allGoals ?? []).filter((g) => g.parentId === goalId);
  const linkedProjects = (allProjects ?? []).filter((p) => {
    if (!goalId) return false;
    if (p.goalIds.includes(goalId)) return true;
    if (p.goals.some((goalRef) => goalRef.id === goalId)) return true;
    return p.goalId === goalId;
  });

  const agentById = new Map((agents ?? []).map((agent) => [agent.id, agent]));
  const planningTask = (goalTasks ?? []).find(
    (issue) => issue.title.startsWith(GOAL_PLANNING_TASK_TITLE_PREFIX) && issue.status !== "done" && issue.status !== "cancelled",
  );
  const planner = planningTask?.assigneeAgentId ? agentById.get(planningTask.assigneeAgentId) : null;
  const goalEntry = overview?.goals.find((entry) => entry.goal.id === goalId) ?? null;
  const overviewProjectById = new Map((overview?.projects ?? []).map((project) => [project.id, project]));
  const overviewGoalById = new Map((overview?.goals ?? []).map((entry) => [entry.goal.id, entry]));

  useEffect(() => {
    setBreadcrumbs([
      { label: "Goals", href: "/goals" },
      { label: goal?.title ?? goalId ?? "Goal" }
    ]);
  }, [setBreadcrumbs, goal, goalId]);

  useEffect(() => {
    if (goal) {
      openPanel(
        <GoalProperties
          goal={goal}
          onUpdate={(data) => updateGoal.mutate(data)}
        />
      );
    }
    return () => closePanel();
  }, [goal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!goal) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-soft-foreground">
            {goalRoleLabel(goal.horizon)}
          </span>
          {goal.horizon ? (
            <span className="text-xs text-muted-foreground">{GOAL_HORIZON_LABEL[goal.horizon]}</span>
          ) : null}
          <StatusBadge status={goal.status} />
          {goalEntry ? <WorkHealthPill progress={goalEntry.progress} /> : null}
          {goal.targetDate ? <span className="text-xs text-muted-foreground">Due {goal.targetDate}</span> : null}
          <AgentName agentId={goal.ownerAgentId} agentById={agentById} prefix="Owner" />
          <div className="ml-auto">
            <GoalPropertiesToggleButton
              panelVisible={panelVisible}
              onShowProperties={() => setPanelVisible(true)}
            />
          </div>
        </div>

        <InlineEditor
          value={goal.title}
          onSave={(title) => updateGoal.mutate({ title })}
          as="h2"
          className="text-xl font-bold"
        />

        <InlineEditor
          value={goal.description ?? ""}
          onSave={(description) => updateGoal.mutate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
          imageUploadHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentPath;
          }}
        />
        {goalEntry ? (
          <div className="rounded-2xl border bg-card p-4 shadow-xs" data-testid="goal-progress">
            <WorkProgressBar progress={goalEntry.progress} />
            <p className="mt-2 text-xs text-muted-foreground">
              {goalEntry.progress.inProgress} in progress · {goalEntry.progress.notStarted} not started · {goalEntry.progress.blocked} stuck · {goalEntry.progress.completedLast7Days} finished this week
            </p>
          </div>
        ) : null}
      </div>

      {planningTask ? (
        <Link
          to={issueUrl(planningTask)}
          data-testid="goal-planning-banner"
          className="flex items-center gap-3 rounded-2xl border border-ring/30 bg-brand-soft/60 p-4 text-sm text-inherit no-underline hover:bg-brand-soft"
        >
          <StatusIcon status={planningTask.status} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-brand-soft-foreground">
              {planner ? `${planner.name} is planning this goal` : "This goal is being planned"}
            </span>
            <span className="block text-xs text-muted-foreground">
              Projects, first tasks, hires, and a budget will come to you for one-click approval.
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-brand-soft-foreground">Open plan</span>
        </Link>
      ) : null}

      <Tabs key={linkedProjects.length === 0 && (goalTasks?.length ?? 0) > 0 ? "tasks" : "projects"} defaultValue={linkedProjects.length === 0 && (goalTasks?.length ?? 0) > 0 ? "tasks" : "projects"}>
        <TabsList>
          <TabsTrigger value="projects">
            Projects ({linkedProjects.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks ({goalTasks?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="children">
            Sub-goals ({childGoals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {(goalTasks ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks linked directly to this goal.</p>
          ) : (
            <div className="flex flex-col rounded-2xl border bg-card p-2">
              {(goalTasks ?? []).map((issue) => {
                const project = issue.projectId ? overviewProjectById.get(issue.projectId) : null;
                const assignee = issue.assigneeAgentId ? agentById.get(issue.assigneeAgentId) : null;
                return (
                  <Link
                    key={issue.id}
                    to={issueUrl(issue)}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-inherit no-underline hover:bg-accent"
                  >
                    <StatusIcon status={issue.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{issue.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {project ? project.name : "Not in a project yet"}
                        {assignee ? ` · ${assignee.name}` : ""}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="children" className="mt-4 space-y-3">
          <div className="flex items-center justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openNewGoal({ parentId: goalId })}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Sub Goal
            </Button>
          </div>
          {childGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sub-goals.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {childGoals.map((child) => {
                const entry = overviewGoalById.get(child.id);
                return (
                  <Link
                    key={child.id}
                    to={`/goals/${child.id}`}
                    className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm text-inherit no-underline hover:bg-accent md:flex-row md:items-center"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{child.title}</span>
                    {entry ? (
                      <span className="flex items-center gap-3 md:w-1/2">
                        <WorkProgressBar progress={entry.progress} size="sm" className="flex-1" />
                        <WorkHealthPill progress={entry.progress} />
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          {linkedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects yet. The goal owner proposes projects in a plan for your OK, or add one from Projects.
            </p>
          ) : (
            <div className="flex flex-col rounded-2xl border bg-card p-2">
              {linkedProjects.map((project) => {
                const entry = overviewProjectById.get(project.id);
                return entry ? (
                  <ProjectRow key={project.id} project={entry} agentById={agentById} />
                ) : (
                  <EntityRow
                    key={project.id}
                    title={project.name}
                    subtitle={project.description ?? undefined}
                    to={projectUrl(project)}
                    trailing={<StatusBadge status={project.status} />}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
