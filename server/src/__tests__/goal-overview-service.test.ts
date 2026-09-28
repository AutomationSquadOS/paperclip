import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, goals, issues, projectGoals, projects } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { goalOverviewService } from "../services/goal-overview.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describeEmbeddedPostgres("goalOverviewService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-goal-overview-");
    db = createDb(tempDb.connectionString);
  }, 30_000);

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("aggregates real rows, including legacy goals and tasks with no project, scoped to one company", async () => {
    const now = new Date();
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const goalId = randomUUID();
    const projectId = randomUUID();
    await db.insert(companies).values([
      { id: companyId, name: "Goal Co", issuePrefix: `G${companyId.slice(0, 4)}` },
      { id: otherCompanyId, name: "Other Co", issuePrefix: `O${otherCompanyId.slice(0, 4)}` },
    ]);
    // Pre-migration shaped goal: no horizon, no target date.
    await db.insert(goals).values({ id: goalId, companyId, title: "Grow", level: "company", status: "active" });
    await db.insert(projects).values({ id: projectId, companyId, name: "Launch", status: "in_progress" });
    await db.insert(projectGoals).values({ projectId, goalId, companyId });
    await db.insert(issues).values([
      { companyId, projectId, goalId, title: "Done recently", status: "done", completedAt: now },
      { companyId, projectId, title: "Done long ago", status: "done", completedAt: new Date("2025-01-01T00:00:00Z") },
      { companyId, projectId, title: "Doing", status: "in_progress" },
      { companyId, title: "Loose task", status: "todo" },
      { companyId, title: "Hidden", status: "todo", hiddenAt: now },
      { companyId: otherCompanyId, title: "Other company", status: "todo" },
    ]);

    const overview = await goalOverviewService(db).get(companyId, now);

    expect(overview.goals).toHaveLength(1);
    expect(overview.goals[0]!.goal.horizon).toBeNull();
    expect(overview.goals[0]!.progress).toMatchObject({ total: 3, done: 2, inProgress: 1, completedLast7Days: 1, percentComplete: 67 });
    expect(overview.projects[0]!.progress.total).toBe(3);
    expect(overview.unplanned.total).toBe(1);
    expect(overview.summary.createdLast7Days).toBe(4);
  });
});
