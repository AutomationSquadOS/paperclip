# Goal-first work hierarchy

Date: 2026-09-27
Owner: Rob (board) · Implementer: Cursor agent
Status: Phase 1 shipping, later phases planned

## Why

Rob wants to say "here's a goal" and have the company organize itself: projects,
tasks, hires, budget, and work, all traceable up and down the chain:

```
Goal  →  Project  →  Task  →  (subtasks)
  ↑          ↑          ↑
 owner     lead      assignee   (agents from the org chart)
```

Every task should explain which project and goal it moves forward. Progress on
tasks should show up as progress on projects and goals. The model borrows the
shape of a well-run operating system for small companies (long-term vision →
yearly goals → quarterly priorities, clear owners, weekly scorecard) without
its trademarked vocabulary or its meeting cadence.

## What already exists (mapped 2026-09-27)

| Area | Today |
|---|---|
| Goals | `goals` table: `title`, `description`, `level` (`company`/`team`/`agent`/`task`), `status` (`planned`/`active`/`achieved`/`cancelled`), `parentId` (nesting), `ownerAgentId`. |
| Projects | `projects.goalId` (legacy) plus the many-to-many `project_goals` table; `leadAgentId`, `targetDate`, `status`. |
| Tasks (issues) | `projectId`, `goalId`, `parentId` (subtasks), single `assigneeAgentId`/`assigneeUserId`, atomic checkout. On create, `goalId` defaults to the project's goal or, when there is no project, to the company's root goal (`issue-goal-fallback.ts`). |
| Org chart | `agents.reportsTo`, `role` (incl. `ceo`). |
| Budgets | Per agent/project/company budget policies with hard-stop auto-pause. |
| Governance | Approvals: `hire_agent` (auto-created when hires need approval), `approve_ceo_strategy`, `request_board_approval`, `budget_override_required`. |
| Agent guidance | `skills/paperclip/SKILL.md` tells agents to set `parentId` + `goalId` on subtasks, and has a planning flow using the `plan` issue document. |
| UI | Goals list (a flat tree, hidden behind the experimental "Goals sidebar link"), goal detail (sub-goals and linked projects tabs), project detail, task detail with a parent-task chain. |

### Gaps against Rob's model

1. There's no progress rollup anywhere. A goal can't say "40% done, at risk".
2. Goals are hidden from the main navigation and don't show their projects or tasks in one place.
3. A task page doesn't show which goal or project it serves.
4. Goals have no time horizon or target date, so "long-term / this year / this quarter" can't be expressed.
5. There's no "here's a goal" entry point. Planning is manual.
6. Tasks without a project float around with no visible "needs a home" bucket.
7. There's no simple weekly status summary.

## Design

### Hierarchy

- **Goal**: an outcome. Optional *horizon*: `long_term` (3–10 years, the "where we're headed" goal), `year` (this year's goals), `quarter` (this quarter's priorities). An optional *target date* applies too. Goals nest via `parentId`, so a quarterly priority can sit under a yearly goal, which sits under the long-term goal. The existing `level` field stays as-is: it describes scope (company/team/agent), while horizon describes time.
- **Project**: a body of work that moves one or more goals. Its description holds the objectives and success criteria. It has a lead agent and an optional target date.
- **Task**: a single-assignee unit of work inside a project, optionally with subtasks.
- **Unplanned**: tasks with no project are shown in a *Not in a project yet* bucket. We never reject or rewrite existing rows. The bucket is computed on read, so it's safe on Rob's live data.

### Ownership and reporting lines

| Level | Owner field | Default |
|---|---|---|
| Goal | `goals.ownerAgentId` | Company lead (CEO / top of org chart) for company-level goals |
| Project | `projects.leadAgentId` | Assigned by the goal owner while planning |
| Task | `issues.assigneeAgentId` | Assigned by the project lead |

Rollups follow the org chart. The owner of a goal sees every project under it, and a project lead sees every task under their project. Because owners are agents with `reportsTo`, a manager can see their reports' goals and projects (later phase: a per-manager rollup view).

### Top-down: "Here's a goal"

1. The board types a goal (Home composer "Goal" mode, or the Goals page).
2. Paperclip creates the goal (`status: active`, `level: company`, owner = company lead agent) and a **planning task** assigned to the lead, linked to the goal.
3. The planning task's brief asks the lead to:
   - write a `plan` document: projects (objectives, success criteria), first tasks, who does what, hires needed, and a budget recommendation;
   - submit the plan for board approval using `approve_ceo_strategy` (payload includes `goalId`, projects, hires, budget), linked to the planning task;
   - after approval, create the projects (`goalIds: [goalId]`), create tasks inside them (`projectId`, `goalId`, `parentId` where relevant), request hires through the normal hiring flow (which creates `hire_agent` approvals when policy requires), and propose budget changes through the normal budget/approval paths.
4. Nothing bypasses governance. The board still approves hires, strategy, and budget exceptions, and the budget hard-stop still applies.

Phase 1 does this in the UI by calling the existing *create goal* and *create task* APIs. That keeps every existing task-creation guard, wakeup, and activity-log path intact. A dedicated server endpoint (for API/CLI parity and atomicity) comes in Phase 2.

### Bottom-up: progress rolls up

- **Task → project**: the project's progress is done ÷ (total − cancelled) over non-hidden tasks with that `projectId`.
- **Project/task → goal**: a goal counts every task linked to the goal directly (`goalId`) or through any project linked to the goal (`project_goals` or legacy `projects.goalId`). Each task counts once.
- **Goal → parent goal**: a parent goal includes all of its descendants' tasks, again counted once.
- **Health** (plain language):
  - `done`: the goal is achieved, or all its tasks are finished.
  - `not_started`: no tasks yet.
  - `off_track`: the target date has passed and the work isn't done.
  - `at_risk`: at least 25% of open tasks are stuck, or progress lags elapsed time by 30 points or more.
  - `on_track`: everything else.
- **Unlinked submissions**: tasks with no project show in *Not in a project yet* with a one-click path to open and file them. Later phase: suggest a project/goal automatically based on title similarity.

### Reporting (no meetings required)

The Goals page header gives a weekly-style summary: tasks finished in the last 7 days, tasks started in the last 7 days, stuck tasks, and goals at risk. Each goal and project shows a health pill and a progress bar. Later phase: a scheduled weekly summary written by the lead agent (a routine) posted to the board inbox.

### Data model (additive only)

Migration `0193_goal_horizon_target_date`:

```sql
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "horizon" text;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "target_date" date;
```

Both columns are nullable with no backfill and no constraint changes. Existing goals stay valid (`horizon = null` means "no timeframe").

### API

- `GET /api/companies/:companyId/goals/overview` returns every goal with its rolled-up and direct progress, health, linked projects (each with its progress, health, lead, and assigned agents), the *Not in a project yet* bucket, projects with no goal, and the weekly summary. It's company-scoped and read-only.
- `createGoalSchema`/`updateGoalSchema` accept `horizon` and `targetDate`.

### UI

- The sidebar's Work section lists **Goals → Projects → Tasks** in that order and is always visible. The old experimental flag no longer hides Goals.
- **Goals page**: a "Start with a goal" composer, a weekly summary strip, and goal cards (progress bar, health, owner, horizon, projects with mini progress bars), plus a *Not in a project yet* card.
- **Goal detail**: a progress header with health and counts, projects with progress, and sub-goals.
- **Project detail**: a "Moves goal: …" link plus a progress bar.
- **Task detail**: a work path strip reading *Goal › Project › (parent tasks) › Task*.
- **Home**: the composer toggles between *Task* and *Goal*, the setup guide says "Set your first goal", and a new *Your goals* card shows top goals with progress.

### Agent-side behavior

`skills/paperclip/SKILL.md` gains a "Goal-first work" section:

- every task must carry `projectId` + `goalId` (use the parent's when delegating);
- if work arrives with no project, file it under the best-matching project or ask the goal owner;
- the "Planning a goal" procedure described above (plan doc → `approve_ceo_strategy` → projects → tasks → hires → budget).

## Rollout

| Phase | Scope | Status |
|---|---|---|
| 1 | Migration (horizon/target date), goal overview rollup API, Goals/Goal/Project/Task hierarchy UI, primary nav, Home goal entry + Your goals card, "Here's a goal" flow (UI-orchestrated), weekly summary strip, agent skill update | **Shipping in this PR** |
| 2 | Server-side `POST /companies/:id/goals/plan` (atomic goal + planning task, CLI/API parity); goal horizon grouping (long-term / year / quarter sections); per-manager rollups on the org chart | Planned |
| 3 | Auto-suggest project/goal for unlinked tasks; one-click "file under…" from the unplanned bucket; plan approval card that lists proposed projects/hires/budget with a single Approve | Planned |
| 4 | Scheduled weekly summary routine by the lead agent; historical progress trend per goal | Planned |

## Risks

- **Rollup cost**: one grouped aggregate over `issues` per company, using existing `(company_id, …)` indexes. It's fine at current scale; cache if needed.
- **Default goal fallback**: tasks with no project already get the company root goal on create. They count toward that goal *and* appear in *Not in a project yet*. That's intentional, since they have a goal but no project.
- **No row rewrites**: existing tasks keep their links, and nothing is moved into a synthetic project.
