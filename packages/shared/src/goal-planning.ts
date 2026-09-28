import type { GoalHorizon } from "./constants.js";
import type { GoalIntakeKind } from "./brief-intake.js";

export const GOAL_PLANNING_TASK_TITLE_PREFIX = "Plan the goal: ";

export function buildGoalPlanningTaskTitle(goalTitle: string): string {
  return `${GOAL_PLANNING_TASK_TITLE_PREFIX}${goalTitle.trim()}`;
}

/**
 * Brief for the company lead when the board sets a goal or pastes a long brief.
 * Mirrors the "Planning a goal" procedure in skills/paperclip/SKILL.md.
 */
export function buildGoalPlanningTaskDescription(input: {
  goalId: string;
  goalTitle: string;
  goalDescription?: string | null;
  kind?: GoalIntakeKind;
  companyHorizon?: GoalHorizon | null;
  quarterlyPriorities?: string[];
  projectId?: string | null;
  projectName?: string | null;
  quarterlyGoalIds?: Array<{ id: string; title: string }>;
}): string {
  if (input.kind === "brief") {
    return buildBriefPlanningTaskDescription(input);
  }
  const context = input.goalDescription?.trim();
  return [
    `The board set a new goal: **${input.goalTitle.trim()}**`,
    context ? `\n${context}\n` : "",
    `Goal id: \`${input.goalId}\``,
    "",
    "You own turning this goal into a plan the board can approve with one click, then getting the work moving.",
    "",
    "1. Write a `plan` document on this task with:",
    "   - **Company goal restatement**: keep it short, quantitative, and owned. Use `horizon: year` or `long_term` — this is not a this-quarter priority.",
    "   - **This-quarter priorities**: 1-3 ninety-day priorities under that company goal (`horizon: quarter`, `parentId` = the company goal). Short titles, one owner each.",
    "   - **Projects**: a body of work under each priority (or directly under the company goal if a priority is not ready). For each: objective, success criteria, lead, target date.",
    "   - **Checkpoints**: 2-5 project-level finish lines per project (dates + what \"done\" looks like). These are the project's near-term goals, not extra company goals.",
    "   - **First tasks**: the first few tasks per project and who should do each one. Every task must have a `projectId`.",
    "   - **Team**: which existing agents to assign, and any new hires needed (role, why, reporting line).",
    "   - **Budget recommendation**: expected monthly spend for this goal and any per-agent or per-project budget changes.",
    "2. Submit the plan for board approval: `POST /api/companies/{companyId}/approvals` with `type: \"approve_ceo_strategy\"`, `issueIds: [this task]`, and a payload containing `goalId`, the plan summary, this-quarter priorities, projects, checkpoints, hires, and the budget recommendation. Move this task to `in_review` while you wait.",
    "3. After approval:",
    "   - create or update this-quarter priorities as goals with `horizon: \"quarter\"` and `parentId` = the company goal;",
    "   - create each project with `goalIds` pointing at its priority (and the company goal) and its `leadAgentId`;",
    "   - create checkpoint and work tasks inside each project with `projectId`, `goalId`, and an assignee;",
    "   - request new hires through the normal hiring flow (it creates `hire_agent` approvals when required);",
    "   - propose budget changes through the normal budget and approval paths. Never bypass an approval or a budget stop.",
    "4. Comment with links to the priorities and projects you created, then mark this task done.",
    "",
    "Every task you or your reports create must carry its `projectId` and `goalId`, so progress rolls up from task → project → this-quarter priority → company goal.",
    "If this looks like a new brand or line of business inside the current company, keep it here. Put the brand in titles. Do not create a new Paperclip company. A future brand/sub-company entity may exist later — mention that in the plan if useful, and do not build it now.",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}

function buildBriefPlanningTaskDescription(input: {
  goalId: string;
  goalTitle: string;
  goalDescription?: string | null;
  companyHorizon?: GoalHorizon | null;
  quarterlyPriorities?: string[];
  projectId?: string | null;
  projectName?: string | null;
  quarterlyGoalIds?: Array<{ id: string; title: string }>;
}): string {
  const brief = input.goalDescription?.trim();
  const starterPriorities = (input.quarterlyGoalIds ?? []).map((item) => `- **${item.title}** (\`${item.id}\`)`);
  const proposed = (input.quarterlyPriorities ?? []).map((title) => `- ${title}`);
  return [
    `The board pasted a **brief** — a long idea, not a finished goal title.`,
    `Draft company goal: **${input.goalTitle.trim()}** (\`${input.goalId}\`, horizon: \`${input.companyHorizon ?? "year"}\`)`,
    input.projectId
      ? `Starter project: **${input.projectName ?? "Untitled"}** (\`${input.projectId}\`)`
      : "",
    "",
    "Do not treat the original paste as the goal title. Restate a short, quantitative company goal. Keep the full brief as the source of truth.",
    "",
    brief ? ["## Original brief", "", brief, ""].join("\n") : "",
    starterPriorities.length > 0
      ? ["## Starter this-quarter priorities (already created — refine or replace after approval)", "", ...starterPriorities, ""].join("\n")
      : proposed.length > 0
        ? ["## Suggested this-quarter priorities", "", ...proposed, ""].join("\n")
        : "",
    "## What to put in the `plan` document",
    "",
    "1. **Company goal restatement** — one concise, measurable this-year or long-term outcome. Brand names stay in the title. This company already exists; a micro-brand is a goal + projects here, not a new Paperclip company.",
    "2. **This-quarter priorities** — 1-3 ninety-day priorities (`horizon: quarter`, `parentId` = company goal). Typical split for a launch brief: catch-up backlog, the recurring per-new-item workflow, and the creative / thumbnail / multi-platform system.",
    "3. **Projects** under those priorities — objective, success criteria, lead, target date.",
    "4. **Checkpoints** — 2-5 project-level finish lines per project (what done looks like + a date). These are the project's goals, not more company goals.",
    "5. **First tasks** — the first work items, each with `projectId` + `goalId` + an assignee.",
    "6. **Hires and budget** — roles, reporting line, and a monthly spend recommendation.",
    "",
    "Submit for board approval: `POST /api/companies/{companyId}/approvals` with `type: \"approve_ceo_strategy\"`, `issueIds: [this task]`, and a payload of `{ goalId, summary, quarterlyPriorities, projects, checkpoints, hires, budgetRecommendation }`. Move this task to `in_review` while you wait. Do not start the work until the board approves.",
    "",
    "After approval, create or update the priorities, projects, checkpoint tasks, work tasks, hire requests, and budget changes through the normal APIs. Never bypass an approval or a budget stop. Comment with links, then mark this task done.",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}
