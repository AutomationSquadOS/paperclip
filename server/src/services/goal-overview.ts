import { and, eq, gte, isNull, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goals, issues, projectGoals, projects } from "@paperclipai/db";
import {
  deriveProjectUrlKey,
  type Goal,
  type GoalOverview,
  type GoalOverviewEntry,
  type GoalOverviewProject,
  type WorkHealth,
  type WorkProgress,
  type WorkProgressCounts,
} from "@paperclipai/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const AT_RISK_BLOCKED_SHARE = 0.25;
const AT_RISK_SCHEDULE_LAG = 0.3;

export interface GoalOverviewTaskGroup {
  goalId: string | null;
  projectId: string | null;
  status: string;
  completedRecently: boolean;
  count: number;
}

export interface GoalOverviewProjectRow {
  id: string;
  name: string;
  status: string;
  leadAgentId: string | null;
  targetDate: string | null;
  createdAt: Date;
  goalIds: string[];
}

export interface GoalOverviewAssigneeRow {
  projectId: string;
  assigneeAgentId: string;
}

export interface GoalOverviewInput {
  companyId: string;
  now: Date;
  goals: Goal[];
  projects: GoalOverviewProjectRow[];
  taskGroups: GoalOverviewTaskGroup[];
  openAssignees: GoalOverviewAssigneeRow[];
  createdLast7Days: number;
}

function emptyCounts(): WorkProgressCounts {
  return { total: 0, done: 0, inProgress: 0, notStarted: 0, blocked: 0, cancelled: 0, completedLast7Days: 0 };
}

function addGroup(counts: WorkProgressCounts, group: GoalOverviewTaskGroup) {
  const n = group.count;
  counts.total += n;
  switch (group.status) {
    case "done":
      counts.done += n;
      if (group.completedRecently) counts.completedLast7Days += n;
      break;
    case "cancelled":
      counts.cancelled += n;
      break;
    case "blocked":
      counts.blocked += n;
      break;
    case "in_progress":
    case "in_review":
      counts.inProgress += n;
      break;
    default:
      counts.notStarted += n;
  }
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computeWorkHealth(input: {
  counts: WorkProgressCounts;
  now: Date;
  startedAt?: Date | null;
  targetDate?: string | null;
  finished?: boolean;
}): Pick<WorkProgress, "percentComplete" | "health"> {
  const { counts } = input;
  const countable = counts.total - counts.cancelled;
  const percentComplete = countable > 0 ? Math.round((counts.done / countable) * 100) : 0;
  let health: WorkHealth;
  if (input.finished || (countable > 0 && counts.done === countable)) {
    health = "done";
  } else if (countable === 0) {
    health = "not_started";
  } else {
    const target = parseDateOnly(input.targetDate ?? null);
    const open = countable - counts.done;
    if (target && target.getTime() < input.now.getTime()) {
      health = "off_track";
    } else if (open > 0 && counts.blocked / open >= AT_RISK_BLOCKED_SHARE) {
      health = "at_risk";
    } else if (target && input.startedAt && target.getTime() > input.startedAt.getTime()) {
      const elapsed = (input.now.getTime() - input.startedAt.getTime()) / (target.getTime() - input.startedAt.getTime());
      health = elapsed - percentComplete / 100 >= AT_RISK_SCHEDULE_LAG ? "at_risk" : "on_track";
    } else {
      health = "on_track";
    }
  }
  return { percentComplete, health };
}

export function computeGoalOverview(input: GoalOverviewInput): GoalOverview {
  const { now } = input;
  const goalById = new Map(input.goals.map((goal) => [goal.id, goal]));
  const childIdsByGoal = new Map<string, string[]>();
  for (const goal of input.goals) {
    if (goal.parentId && goalById.has(goal.parentId)) {
      const list = childIdsByGoal.get(goal.parentId) ?? [];
      list.push(goal.id);
      childIdsByGoal.set(goal.parentId, list);
    }
  }

  const ancestorsCache = new Map<string, string[]>();
  const selfAndAncestors = (goalId: string): string[] => {
    const cached = ancestorsCache.get(goalId);
    if (cached) return cached;
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor: string | null = goalId;
    while (cursor && goalById.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      chain.push(cursor);
      cursor = goalById.get(cursor)!.parentId;
    }
    ancestorsCache.set(goalId, chain);
    return chain;
  };

  const projectById = new Map(
    input.projects.map((project) => [
      project.id,
      { ...project, goalIds: project.goalIds.filter((goalId) => goalById.has(goalId)) },
    ]),
  );
  const projectIdsByGoal = new Map<string, string[]>();
  for (const project of projectById.values()) {
    for (const goalId of project.goalIds) {
      const list = projectIdsByGoal.get(goalId) ?? [];
      list.push(project.id);
      projectIdsByGoal.set(goalId, list);
    }
  }

  const rolledCounts = new Map<string, WorkProgressCounts>();
  const directCounts = new Map<string, WorkProgressCounts>();
  const projectCounts = new Map<string, WorkProgressCounts>();
  const tasksWithoutProjectByGoal = new Map<string, number>();
  const unplanned = emptyCounts();
  const totals = emptyCounts();
  const countsFor = (map: Map<string, WorkProgressCounts>, id: string) => {
    let counts = map.get(id);
    if (!counts) {
      counts = emptyCounts();
      map.set(id, counts);
    }
    return counts;
  };

  for (const group of input.taskGroups) {
    addGroup(totals, group);
    const project = group.projectId ? projectById.get(group.projectId) : undefined;
    if (project) {
      addGroup(countsFor(projectCounts, project.id), group);
    } else {
      addGroup(unplanned, group);
    }

    const direct = new Set<string>();
    if (group.goalId && goalById.has(group.goalId)) {
      direct.add(group.goalId);
      if (!project && group.status !== "cancelled") {
        tasksWithoutProjectByGoal.set(group.goalId, (tasksWithoutProjectByGoal.get(group.goalId) ?? 0) + group.count);
      }
    }
    for (const goalId of project?.goalIds ?? []) direct.add(goalId);
    for (const goalId of direct) addGroup(countsFor(directCounts, goalId), group);

    const rolled = new Set<string>();
    for (const goalId of direct) for (const id of selfAndAncestors(goalId)) rolled.add(id);
    for (const goalId of rolled) addGroup(countsFor(rolledCounts, goalId), group);
  }

  const assigneesByProject = new Map<string, Set<string>>();
  for (const row of input.openAssignees) {
    const set = assigneesByProject.get(row.projectId) ?? new Set<string>();
    set.add(row.assigneeAgentId);
    assigneesByProject.set(row.projectId, set);
  }

  const projectsOut: GoalOverviewProject[] = [...projectById.values()].map((project) => {
    const counts = projectCounts.get(project.id) ?? emptyCounts();
    return {
      id: project.id,
      name: project.name,
      urlKey: deriveProjectUrlKey(project.name, project.id),
      status: project.status,
      leadAgentId: project.leadAgentId,
      targetDate: project.targetDate,
      goalIds: project.goalIds,
      assigneeAgentIds: [...(assigneesByProject.get(project.id) ?? [])],
      progress: {
        ...counts,
        ...computeWorkHealth({
          counts,
          now,
          startedAt: project.createdAt,
          targetDate: project.targetDate,
          finished: project.status === "completed",
        }),
      },
    };
  });

  const goalsOut: GoalOverviewEntry[] = input.goals.map((goal) => {
    const finished = goal.status === "achieved";
    const rolled = rolledCounts.get(goal.id) ?? emptyCounts();
    const direct = directCounts.get(goal.id) ?? emptyCounts();
    const healthInput = { now, startedAt: new Date(goal.createdAt), targetDate: goal.targetDate ?? null, finished };
    return {
      goal,
      progress: { ...rolled, ...computeWorkHealth({ counts: rolled, ...healthInput }) },
      directProgress: { ...direct, ...computeWorkHealth({ counts: direct, ...healthInput }) },
      projectIds: projectIdsByGoal.get(goal.id) ?? [],
      childGoalIds: childIdsByGoal.get(goal.id) ?? [],
      tasksWithoutProject: tasksWithoutProjectByGoal.get(goal.id) ?? 0,
    };
  });

  const liveGoals = goalsOut.filter((entry) => entry.goal.status === "active" || entry.goal.status === "planned");

  return {
    companyId: input.companyId,
    generatedAt: now.toISOString(),
    goals: goalsOut,
    projects: projectsOut,
    unplanned: { ...unplanned, ...computeWorkHealth({ counts: unplanned, now }) },
    projectsWithoutGoal: projectsOut.filter((project) => project.goalIds.length === 0).map((project) => project.id),
    summary: {
      completedLast7Days: totals.completedLast7Days,
      createdLast7Days: input.createdLast7Days,
      blocked: totals.blocked,
      goalsAtRisk: liveGoals.filter((entry) => entry.progress.health === "at_risk" || entry.progress.health === "off_track").length,
      activeGoals: liveGoals.length,
    },
  };
}

export function goalOverviewService(db: Db) {
  return {
    get: async (companyId: string, now = new Date()): Promise<GoalOverview> => {
      const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
      const [goalRows, projectRows, projectGoalRows, taskGroups, openAssignees, createdRows] = await Promise.all([
        db.select().from(goals).where(eq(goals.companyId, companyId)),
        db
          .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
            leadAgentId: projects.leadAgentId,
            targetDate: projects.targetDate,
            createdAt: projects.createdAt,
            goalId: projects.goalId,
          })
          .from(projects)
          .where(and(eq(projects.companyId, companyId), isNull(projects.archivedAt))),
        db
          .select({ projectId: projectGoals.projectId, goalId: projectGoals.goalId })
          .from(projectGoals)
          .where(eq(projectGoals.companyId, companyId)),
        db
          .select({
            goalId: issues.goalId,
            projectId: issues.projectId,
            status: issues.status,
            completedRecently: sql<boolean>`coalesce(${issues.completedAt} >= ${weekAgo.toISOString()}::timestamptz, false)`,
            count: sql<number>`count(*)::int`,
          })
          .from(issues)
          .where(and(eq(issues.companyId, companyId), isNull(issues.hiddenAt)))
          // Positional: the "completed recently" expression binds its own parameter, so it can't be repeated here.
          .groupBy(sql`1, 2, 3, 4`),
        db
          .selectDistinct({ projectId: issues.projectId, assigneeAgentId: issues.assigneeAgentId })
          .from(issues)
          .where(
            and(
              eq(issues.companyId, companyId),
              isNull(issues.hiddenAt),
              isNotNull(issues.projectId),
              isNotNull(issues.assigneeAgentId),
              sql`${issues.status} not in ('done', 'cancelled')`,
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(issues)
          .where(and(eq(issues.companyId, companyId), isNull(issues.hiddenAt), gte(issues.createdAt, weekAgo))),
      ]);

      const goalIdsByProject = new Map<string, Set<string>>();
      for (const row of projectRows) {
        if (row.goalId) goalIdsByProject.set(row.id, new Set([row.goalId]));
      }
      for (const row of projectGoalRows) {
        const set = goalIdsByProject.get(row.projectId) ?? new Set<string>();
        set.add(row.goalId);
        goalIdsByProject.set(row.projectId, set);
      }

      return computeGoalOverview({
        companyId,
        now,
        goals: goalRows as Goal[],
        projects: projectRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          leadAgentId: row.leadAgentId,
          targetDate: row.targetDate,
          createdAt: row.createdAt,
          goalIds: [...(goalIdsByProject.get(row.id) ?? [])],
        })),
        taskGroups: taskGroups.map((row) => ({
          goalId: row.goalId,
          projectId: row.projectId,
          status: row.status,
          completedRecently: Boolean(row.completedRecently),
          count: Number(row.count) || 0,
        })),
        openAssignees: openAssignees.flatMap((row) =>
          row.projectId && row.assigneeAgentId
            ? [{ projectId: row.projectId, assigneeAgentId: row.assigneeAgentId }]
            : [],
        ),
        createdLast7Days: Number(createdRows[0]?.count ?? 0),
      });
    },
  };
}
