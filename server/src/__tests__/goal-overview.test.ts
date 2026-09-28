import { describe, expect, it } from "vitest";
import type { Goal } from "@paperclipai/shared";
import { computeGoalOverview, computeWorkHealth } from "../services/goal-overview.js";

const now = new Date("2026-09-27T12:00:00Z");

function goal(id: string, overrides: Partial<Goal> = {}): Goal {
  return {
    id,
    companyId: "company-1",
    title: id,
    description: null,
    level: "company",
    status: "active",
    parentId: null,
    ownerAgentId: null,
    horizon: null,
    targetDate: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

describe("computeGoalOverview", () => {
  it("rolls tasks up through projects and parent goals, counting each task once", () => {
    const overview = computeGoalOverview({
      companyId: "company-1",
      now,
      goals: [goal("vision"), goal("q4", { parentId: "vision" })],
      projects: [
        {
          id: "launch",
          name: "Launch site",
          status: "in_progress",
          leadAgentId: "agent-lead",
          targetDate: null,
          createdAt: new Date("2026-09-01T00:00:00Z"),
          goalIds: ["q4"],
        },
      ],
      taskGroups: [
        // Linked to the project *and* directly to the same goal: must not double count.
        { goalId: "q4", projectId: "launch", status: "done", completedRecently: true, count: 2 },
        { goalId: "q4", projectId: "launch", status: "todo", completedRecently: false, count: 2 },
        // Legacy tasks with no project fall back to the root goal.
        { goalId: "vision", projectId: null, status: "in_progress", completedRecently: false, count: 1 },
        { goalId: null, projectId: null, status: "backlog", completedRecently: false, count: 3 },
      ],
      openAssignees: [{ projectId: "launch", assigneeAgentId: "agent-dev" }],
      createdLast7Days: 4,
    });

    const byId = new Map(overview.goals.map((entry) => [entry.goal.id, entry]));
    const q4 = byId.get("q4")!;
    expect(q4.progress.total).toBe(4);
    expect(q4.progress.percentComplete).toBe(50);
    expect(q4.projectIds).toEqual(["launch"]);

    const vision = byId.get("vision")!;
    expect(vision.progress.total).toBe(5);
    expect(vision.directProgress.total).toBe(1);
    expect(vision.childGoalIds).toEqual(["q4"]);
    expect(vision.tasksWithoutProject).toBe(1);

    expect(overview.projects[0]!.progress.total).toBe(4);
    expect(overview.projects[0]!.assigneeAgentIds).toEqual(["agent-dev"]);
    expect(overview.unplanned.total).toBe(4);
    expect(overview.projectsWithoutGoal).toEqual([]);
    expect(overview.summary).toMatchObject({ completedLast7Days: 2, createdLast7Days: 4, activeGoals: 2 });
  });

  it("ignores links to goals from other companies or deleted goals", () => {
    const overview = computeGoalOverview({
      companyId: "company-1",
      now,
      goals: [goal("g1")],
      projects: [
        { id: "p1", name: "P", status: "planned", leadAgentId: null, targetDate: null, createdAt: now, goalIds: ["missing"] },
      ],
      taskGroups: [{ goalId: "missing", projectId: "p1", status: "todo", completedRecently: false, count: 1 }],
      openAssignees: [],
      createdLast7Days: 0,
    });
    expect(overview.goals[0]!.progress.total).toBe(0);
    expect(overview.projectsWithoutGoal).toEqual(["p1"]);
  });
});

describe("computeWorkHealth", () => {
  const base = { total: 4, done: 1, inProgress: 1, notStarted: 2, blocked: 0, cancelled: 0, completedLast7Days: 0 };

  it("reports not started, done, and cancelled-aware percent", () => {
    expect(computeWorkHealth({ counts: { ...base, total: 0, done: 0, inProgress: 0, notStarted: 0 }, now }).health).toBe("not_started");
    expect(computeWorkHealth({ counts: { ...base, total: 3, done: 2, inProgress: 0, notStarted: 0, cancelled: 1 }, now })).toEqual({
      percentComplete: 100,
      health: "done",
    });
  });

  it("flags stuck work and missed or slipping target dates", () => {
    expect(computeWorkHealth({ counts: { ...base, blocked: 1, notStarted: 1 }, now }).health).toBe("at_risk");
    expect(computeWorkHealth({ counts: base, now, targetDate: "2026-09-01" }).health).toBe("off_track");
    expect(
      computeWorkHealth({ counts: base, now, startedAt: new Date("2026-09-01T00:00:00Z"), targetDate: "2026-09-30" }).health,
    ).toBe("at_risk");
    expect(
      computeWorkHealth({ counts: base, now, startedAt: new Date("2026-09-25T00:00:00Z"), targetDate: "2026-12-31" }).health,
    ).toBe("on_track");
  });
});
