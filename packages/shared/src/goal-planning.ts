export const GOAL_PLANNING_TASK_TITLE_PREFIX = "Plan the goal: ";

export function buildGoalPlanningTaskTitle(goalTitle: string): string {
  return `${GOAL_PLANNING_TASK_TITLE_PREFIX}${goalTitle.trim()}`;
}

/**
 * Brief for the company lead when the board says "here's a goal".
 * Mirrors the "Planning a goal" procedure in skills/paperclip/SKILL.md.
 */
export function buildGoalPlanningTaskDescription(input: {
  goalId: string;
  goalTitle: string;
  goalDescription?: string | null;
}): string {
  const context = input.goalDescription?.trim();
  return [
    `The board set a new goal: **${input.goalTitle.trim()}**`,
    context ? `\n${context}\n` : "",
    `Goal id: \`${input.goalId}\``,
    "",
    "You own turning this goal into a plan the board can approve with one click, then getting the work moving.",
    "",
    "1. Write a `plan` document on this task with:",
    "   - **Projects**: 1-4 projects that together achieve the goal. For each: objective, success criteria, lead agent, target date.",
    "   - **First tasks**: the first few tasks per project and who should do each one.",
    "   - **Team**: which existing agents to assign, and any new hires needed (role, why, reporting line).",
    "   - **Budget recommendation**: expected monthly spend for this goal and any per-agent or per-project budget changes.",
    "2. Submit the plan for board approval: `POST /api/companies/{companyId}/approvals` with `type: \"approve_ceo_strategy\"`, `issueIds: [this task]`, and a payload containing `goalId`, the plan summary, projects, hires, and the budget recommendation. Move this task to `in_review` while you wait.",
    "3. After approval:",
    "   - create each project with `goalIds: [goalId]` and its `leadAgentId`;",
    "   - create tasks inside each project with `projectId`, `goalId`, and an assignee;",
    "   - request new hires through the normal hiring flow (it creates `hire_agent` approvals when required);",
    "   - propose budget changes through the normal budget and approval paths. Never bypass an approval or a budget stop.",
    "4. Comment with links to the projects you created, then mark this task done.",
    "",
    "Every task you or your reports create for this goal must carry its `projectId` and `goalId`, so progress rolls up to the goal.",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}
