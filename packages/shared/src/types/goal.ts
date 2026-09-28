import type { GoalHorizon, GoalLevel, GoalStatus, WorkHealth } from "../constants.js";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  status: GoalStatus;
  parentId: string | null;
  ownerAgentId: string | null;
  horizon?: GoalHorizon | null;
  /** YYYY-MM-DD */
  targetDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkProgressCounts {
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
  cancelled: number;
  completedLast7Days: number;
}

export interface WorkProgress extends WorkProgressCounts {
  /** 0–100, done ÷ (total − cancelled). */
  percentComplete: number;
  health: WorkHealth;
}

export interface GoalOverviewProject {
  id: string;
  name: string;
  urlKey: string;
  status: string;
  leadAgentId: string | null;
  targetDate: string | null;
  goalIds: string[];
  /** Agents with open tasks in this project. */
  assigneeAgentIds: string[];
  progress: WorkProgress;
}

export interface GoalOverviewEntry {
  goal: Goal;
  /** Includes every descendant goal's work, each task counted once. */
  progress: WorkProgress;
  /** Only tasks linked to this goal directly or through its own projects. */
  directProgress: WorkProgress;
  projectIds: string[];
  childGoalIds: string[];
  /** Direct tasks on this goal that have no project. */
  tasksWithoutProject: number;
}

export interface GoalOverviewSummary {
  completedLast7Days: number;
  createdLast7Days: number;
  blocked: number;
  goalsAtRisk: number;
  activeGoals: number;
}

export interface GoalOverview {
  companyId: string;
  generatedAt: string;
  goals: GoalOverviewEntry[];
  projects: GoalOverviewProject[];
  /** Tasks with no project: the "Not in a project yet" bucket. */
  unplanned: WorkProgress;
  projectsWithoutGoal: string[];
  summary: GoalOverviewSummary;
}
