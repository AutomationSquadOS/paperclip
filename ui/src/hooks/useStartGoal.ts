import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildGoalPlanningTaskDescription,
  buildGoalPlanningTaskTitle,
  type Agent,
  type Goal,
  type GoalHorizon,
  type Issue,
} from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useToastActions } from "../context/ToastContext";
import { useNavigate } from "@/lib/router";
import { pickCompanyLeadAgent } from "../lib/goal-hierarchy";
import { queryKeys } from "../lib/queryKeys";

export interface StartGoalInput {
  title: string;
  description?: string | null;
  horizon?: GoalHorizon | null;
}

export interface StartGoalResult {
  goal: Goal;
  lead: Agent | null;
  planningTask: Issue | null;
  planningError: string | null;
}

/**
 * "Here's a goal": create the goal, then hand a planning task to the company
 * lead. Uses the normal goal/task APIs so every task-creation guard, wakeup,
 * and activity-log entry still applies.
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
      const title = input.title.trim();
      if (!title) throw new Error("Describe the goal first.");
      const description = input.description?.trim() || null;
      const goal = await goalsApi.create(selectedCompanyId, {
        title,
        description,
        level: "company",
        status: "active",
        horizon: input.horizon ?? null,
        ownerAgentId: lead?.id ?? null,
      });
      if (!lead) return { goal, lead, planningTask: null, planningError: null };
      try {
        const planningTask = await issuesApi.create(selectedCompanyId, {
          title: buildGoalPlanningTaskTitle(title),
          description: buildGoalPlanningTaskDescription({ goalId: goal.id, goalTitle: title, goalDescription: description }),
          goalId: goal.id,
          assigneeAgentId: lead.id,
          priority: "high",
          status: "todo",
        });
        return { goal, lead, planningTask, planningError: null };
      } catch (error) {
        return {
          goal,
          lead,
          planningTask: null,
          planningError: error instanceof Error ? error.message : "Could not create the planning task.",
        };
      }
    },
    onSuccess: (result) => {
      if (selectedCompanyId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.list(selectedCompanyId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId) });
      }
      if (result.planningError) {
        pushToast({
          title: "Goal saved, but planning didn't start",
          body: result.planningError,
          tone: "error",
        });
      } else if (result.planningTask && result.lead) {
        pushToast({
          title: "Goal set",
          body: `${result.lead.name} is drafting a plan: projects, tasks, hires, and budget for your OK.`,
          tone: "success",
        });
      } else {
        pushToast({ title: "Goal set", body: "Hire a lead agent so someone can plan the work.", tone: "success" });
      }
      navigate(`/goals/${result.goal.id}`);
    },
    onError: (error) => {
      pushToast({
        title: "Couldn't set the goal",
        body: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    },
  });

  return { startGoal: mutation.mutate, isPending: mutation.isPending, lead };
}
