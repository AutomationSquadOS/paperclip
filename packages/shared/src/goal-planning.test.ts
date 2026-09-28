import { describe, expect, it } from "vitest";
import { buildGoalPlanningTaskDescription, buildGoalPlanningTaskTitle } from "./goal-planning.js";

describe("goal planning payload", () => {
  it("keeps the short-goal planning title prefix", () => {
    expect(buildGoalPlanningTaskTitle("Reach 100 customers")).toBe("Plan the goal: Reach 100 customers");
  });

  it("asks a brief planner for company goal, quarter priorities, projects, checkpoints, and approval", () => {
    const description = buildGoalPlanningTaskDescription({
      goalId: "goal-1",
      goalTitle: "Launch Broncobro's YouTube channel",
      goalDescription: "Original dump stays here",
      kind: "brief",
      companyHorizon: "year",
      quarterlyPriorities: ["Broncobro: Catch up the existing backlog"],
      quarterlyGoalIds: [{ id: "q-1", title: "Broncobro: Catch up the existing backlog" }],
      projectId: "proj-1",
      projectName: "Broncobro YouTube channel",
    });
    expect(description).toContain("pasted a **brief**");
    expect(description).toContain("Original dump stays here");
    expect(description).toContain("This-quarter priorities");
    expect(description).toContain("Checkpoints");
    expect(description).toContain("approve_ceo_strategy");
    expect(description).toContain("not a new Paperclip company");
    expect(description).not.toContain("Rock");
    expect(description).not.toContain("L10");
    expect(description).not.toContain("V/TO");
  });
});
