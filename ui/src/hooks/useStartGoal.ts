import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildGoalPlanningTaskDescription,
  buildGoalPlanningTaskTitle,
  resolveGoalIntake,
  type Agent,
  type Goal,
  type GoalHorizon,
  type GoalIntakeKind,
  type Issue,
  type Project,
} from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useToastActions } from "../context/ToastContext";
import { useNavigate } from "@/lib/router";
import { pickCompanyLeadAgent } from "../lib/goal-hierarchy";
import { queryKeys } from "../lib/queryKeys";

export interface StartGoalInput {
  title: string;
  description?: string | null;
  horizon?: GoalHorizon | null;
  kind?: GoalIntakeKind;
}

export interface StartGoalResult {
  goal: Goal;
  lead: Agent | null;
  planningTask: Issue | null;
  project: Project | null;
  quarterlyGoals: Goal[];
  planningError: string | null;
}

/**
 * Start from a short goal or a long brief. Uses the normal goal / project /
 * task APIs so every guard, wakeup, and activity-log entry still applies.
 */
export function useStartGoal() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pushToast } = useToastActions();
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const lead = pickCompanyLeadAgent(agents);

  const mutation = useMutation({
    mutationFn: async (input: StartGoalInput): Promise<StartGoalResult> => {
      if (!selectedCompanyId) throw new Error("Pick a company first.");
      const intake = resolveGoalIntake(input);
      if (!intake.title) throw new Error("Describe the goal first.");

      const goal = await goalsApi.create(selectedCompanyId, {
        title: intake.title,
        description: intake.description,
        level: "company",
        status: "active",
        horizon: intake.companyHorizon,
        ownerAgentId: lead?.id ?? null,
      });

      const quarterlyGoals: Goal[] = [];
      if (intake.kind === "brief") {
        for (const title of intake.quarterlyPriorities) {
          try {
            const priority = await goalsApi.create(selectedCompanyId, {
              title,
              description: intake.brief,
              level: "company",
              status: "active",
              horizon: "quarter",
              parentId: goal.id,
              ownerAgentId: lead?.id ?? null,
            });
            quarterlyGoals.push(priority);
          } catch {
            // Keep going — the planning task still asks the lead to create them.
          }
        }
      }

      let project: Project | null = null;
      if (intake.kind === "brief" && intake.projectName) {
        const linkedGoalIds = [goal.id, ...quarterlyGoals.map((item) => item.id)];
        try {
          project = await projectsApi.create(selectedCompanyId, {
            name: intake.projectName,
            description: intake.brief,
            status: "planned",
            goalIds: linkedGoalIds,
            leadAgentId: lead?.id ?? null,
          });
        } catch {
          project = null;
        }
      }

      if (!lead) {
        return { goal, lead, planningTask: null, project, quarterlyGoals, planningError: null };
      }

      try {
        const planningTask = await issuesApi.create(selectedCompanyId, {
          title: buildGoalPlanningTaskTitle(intake.title),
          description: buildGoalPlanningTaskDescription({
            goalId: goal.id,
            goalTitle: intake.title,
            goalDescription: intake.kind === "brief" ? intake.brief : intake.description,
            kind: intake.kind,
            companyHorizon: intake.companyHorizon,
            quarterlyPriorities: intake.quarterlyPriorities,
            quarterlyGoalIds: quarterlyGoals.map((item) => ({ id: item.id, title: item.title })),
            projectId: project?.id ?? null,
            projectName: project?.name ?? intake.projectName,
          }),
          goalId: goal.id,
          projectId: project?.id ?? undefined,
          assigneeAgentId: lead.id,
          priority: "high",
          status: "todo",
        });
        return { goal, lead, planningTask, project, quarterlyGoals, planningError: null };
      } catch (error) {
        return {
          goal,
          lead,
          planningTask: null,
          project,
          quarterlyGoals,
          planningError: error instanceof Error ? error.message : "Could not create the planning task.",
        };
      }
    },
    onSuccess: (result, input) => {
      if (selectedCompanyId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.list(selectedCompanyId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.overview(selectedCompanyId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId) });
      }
      const intake = resolveGoalIntake(input);
      if (result.planningError) {
        pushToast({
          title: intake.kind === "brief" ? "Brief saved, but planning didn't start" : "Goal saved, but planning didn't start",
          body: result.planningError,
          tone: "error",
        });
      } else if (result.planningTask && result.lead) {
        pushToast({
          title: intake.kind === "brief" ? "Brief captured" : "Goal set",
          body: `${result.lead.name} is drafting a plan: company goal, this-quarter priorities, projects, checkpoints, hires, and budget for your OK.`,
          tone: "success",
        });
      } else {
        pushToast({
          title: intake.kind === "brief" ? "Brief captured" : "Goal set",
          body: "Hire a lead agent so someone can plan the work.",
          tone: "success",
        });
      }
      navigate(`/goals/${result.goal.id}`);
    },
    onError: (error) => {
      pushToast({
        title: "Couldn't start that",
        body: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    },
  });

  return { startGoal: mutation.mutate, isPending: mutation.isPending, lead };
}
