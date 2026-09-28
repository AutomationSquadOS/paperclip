import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, AgentStatus, Approval, GoalOverview, Issue } from "@paperclipai/shared";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Inbox as InboxIcon,
  LayoutDashboard,
  ListTodo,
  PartyPopper,
  PauseCircle,
  Sparkles,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { authApi } from "../api/auth";
import { dashboardApi } from "../api/dashboard";
import { goalsApi } from "../api/goals";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { AgentIcon } from "../components/AgentIconPicker";
import { approvalLabel } from "../components/ApprovalPayload";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { WorkHealthPill, WorkProgressBar } from "../components/GoalProgress";
import { useStartGoal } from "../hooks/useStartGoal";
import { GOAL_HORIZON_LABEL } from "../lib/goal-hierarchy";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { agentUrl, cn, formatCents, issueUrl } from "../lib/utils";

const TASK_IDEAS = [
  "Research our top 5 competitors",
  "Draft a launch announcement",
  "Plan next week's priorities",
];

const GOAL_IDEAS = [
  "Get our first 100 paying customers",
  "Launch the new website this quarter",
  "Publish two articles every week",
];

type ComposerMode = "goal" | "task";

const FRIENDLY_TASK_STATUS: Record<string, string> = {
  backlog: "Not started",
  todo: "Up next",
  in_progress: "In progress",
  in_review: "Ready for review",
  done: "Done",
  blocked: "Stuck",
  cancelled: "Cancelled",
};

const FRIENDLY_AGENT_STATUS: Record<AgentStatus, { label: string; tone: string }> = {
  running: { label: "Working now", tone: "bg-tint-sky text-tint-sky-foreground" },
  active: { label: "Ready", tone: "bg-tint-mint text-tint-mint-foreground" },
  idle: { label: "Ready", tone: "bg-tint-mint text-tint-mint-foreground" },
  paused: { label: "Paused", tone: "bg-tint-peach text-tint-peach-foreground" },
  error: { label: "Needs help", tone: "bg-tint-rose text-tint-rose-foreground" },
  pending_approval: { label: "Waiting for you", tone: "bg-brand-soft text-brand-soft-foreground" },
  terminated: { label: "Retired", tone: "bg-muted text-muted-foreground" },
};

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function isBuiltInAgent(agent: Agent) {
  const metadata = agent.metadata as Record<string, unknown> | null | undefined;
  return Boolean(metadata && metadata.paperclipBuiltInAgent);
}

function firstName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.toLowerCase() === "board") return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

export function Home() {
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { openNewIssue, openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [chosenMode, setChosenMode] = useState<ComposerMode | null>(null);
  const { startGoal, isPending: goalPending, lead } = useStartGoal();

  useEffect(() => {
    setBreadcrumbs([{ label: "Home" }]);
  }, [setBreadcrumbs]);

  const enabled = !!selectedCompanyId;
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const { data: dashboard } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled,
  });
  const { data: goalOverview } = useQuery({
    queryKey: queryKeys.goals.overview(selectedCompanyId!),
    queryFn: () => goalsApi.overview(selectedCompanyId!),
    enabled,
  });
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled,
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled,
  });
  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled,
  });
  const { data: recentIssues, isLoading: issuesLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "home-recent"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { limit: 6, sortField: "updated", sortDir: "desc" }),
    enabled,
  });

  const visibleAgents = useMemo(
    () => (agents ?? []).filter((agent) => agent.status !== "terminated" && !isBuiltInAgent(agent)),
    [agents],
  );
  const pendingApprovals = useMemo(
    () => (approvals ?? []).filter((approval) => approval.status === "pending"),
    [approvals],
  );
  const issueTitleById = useMemo(
    () => new Map((recentIssues ?? []).map((issue) => [issue.id, issue.title])),
    [recentIssues],
  );
  const runningByAgent = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const run of liveRuns ?? []) {
      map.set(run.agentId, run.issueId ? issueTitleById.get(run.issueId) ?? null : null);
    }
    return map;
  }, [liveRuns, issueTitleById]);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          title="Welcome to Paperclip"
          message="Set up your company and first agent in about two minutes."
          action="Get started"
          onAction={openOnboarding}
        />
      );
    }
    return <EmptyState icon={LayoutDashboard} message="Pick a company from the menu to get started." />;
  }

  const name = firstName(session?.user?.name);
  const hasAgents = visibleAgents.length > 0;
  const totalTasks = dashboard
    ? dashboard.tasks.open + dashboard.tasks.inProgress + dashboard.tasks.done + dashboard.tasks.blocked
    : (recentIssues?.length ?? 0);
  const hasTasks = totalTasks > 0 || (recentIssues?.length ?? 0) > 0;
  const hasResults = (dashboard?.tasks.done ?? 0) > 0;
  const liveGoals = (goalOverview?.goals ?? []).filter(
    (entry) => entry.goal.status === "active" || entry.goal.status === "planned",
  );
  const hasGoals = liveGoals.length > 0;
  const mode: ComposerMode = chosenMode ?? (hasGoals ? "task" : "goal");
  const showChecklist = !agentsLoading && !(hasAgents && (hasGoals || hasTasks) && hasResults);
  const workingCount = liveRuns?.length ?? dashboard?.agents.running ?? 0;

  function submitDraft(event?: FormEvent) {
    event?.preventDefault();
    const title = draft.trim();
    if (mode === "goal") {
      if (!title || goalPending) return;
      startGoal({ title }, { onSuccess: () => setDraft("") });
      return;
    }
    openNewIssue(title ? { title } : {});
    setDraft("");
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      submitDraft(event);
    }
  }

  const hireAgent = () => openOnboarding({ initialStep: 2, companyId: selectedCompanyId });

  return (
    <div className="mx-auto flex w-full max-w-(--home-content-max) flex-col gap-6 md:gap-8 animate-rise-in" data-testid="home-page">
      <section className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--home-hero-glow)" />
        <div className="relative flex flex-col gap-6 px-5 py-7 md:px-10 md:py-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{selectedCompany?.name ?? "Your company"}</p>
            <h1 className="font-display text-4xl leading-tight text-foreground md:text-5xl">
              {greetingFor(new Date())}{name ? `, ${name}` : ""}
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              {hasAgents
                ? "Start with a goal and your lead agent plans the projects and tasks, or hand off a single task."
                : "Paperclip runs a team of AI agents for you. Start by hiring your first one."}
            </p>
          </div>

          {hasAgents ? (
            <form onSubmit={submitDraft} className="flex flex-col gap-3">
              <div className="rounded-2xl border bg-surface-raised shadow-md transition-shadow focus-within:border-ring/60 focus-within:shadow-lg focus-within:ring-4 focus-within:ring-ring/15">
                <div role="tablist" aria-label="What are you adding?" className="flex gap-1 px-4 pt-3">
                  {(["goal", "task"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={mode === option}
                      onClick={() => {
                        setChosenMode(option);
                        composerRef.current?.focus();
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        mode === option ? "bg-brand-soft text-brand-soft-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option === "goal" ? <Target className="h-3.5 w-3.5" /> : <ListTodo className="h-3.5 w-3.5" />}
                      {option === "goal" ? "Goal" : "Task"}
                    </button>
                  ))}
                </div>
                <label htmlFor="home-composer" className="sr-only">
                  {mode === "goal" ? "Describe a goal" : "Describe a task for your agents"}
                </label>
                <textarea
                  id="home-composer"
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKey}
                  rows={2}
                  placeholder={mode === "goal" ? "What do you want to achieve?" : "What should your agents work on next?"}
                  className="block min-h-(--home-composer-min) w-full resize-none rounded-2xl bg-transparent px-5 pt-4 text-base text-foreground outline-none placeholder:text-muted-foreground/80"
                />
                <div className="flex items-center justify-between gap-3 px-4 pb-3">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {mode === "goal"
                      ? lead
                        ? `${lead.name} will plan projects, tasks, hires, and budget for your OK.`
                        : "Your lead agent will plan projects, tasks, hires, and budget for your OK."
                      : "Press Enter to continue. You'll pick who does it next."}
                  </span>
                  <Button type="submit" className="ml-auto rounded-full px-5" disabled={mode === "goal" && (goalPending || !draft.trim())}>
                    {mode === "goal" ? (goalPending ? "Setting goal…" : "Set goal") : "New task"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Try</span>
                {(mode === "goal" ? GOAL_IDEAS : TASK_IDEAS).map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => {
                      setDraft(idea);
                      composerRef.current?.focus();
                    }}
                    className="rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-foreground/80 shadow-xs transition-colors hover:border-ring/40 hover:bg-brand-soft hover:text-brand-soft-foreground"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </form>
          ) : (
            <div>
              <Button size="lg" className="rounded-full px-6" onClick={hireAgent}>
                <UserPlus className="h-4 w-4" />
                Hire your first agent
              </Button>
            </div>
          )}

          {dashboard && hasAgents ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <StatPill to="/agents/all" dotClass={workingCount > 0 ? "bg-status-running animate-pulse" : "bg-muted-foreground/40"}>
                {workingCount} working now
              </StatPill>
              <StatPill to="/issues">{dashboard.tasks.open + dashboard.tasks.inProgress} open tasks</StatPill>
              <StatPill to="/costs">{formatCents(dashboard.costs.monthSpendCents)} spent this month</StatPill>
            </div>
          ) : null}
        </div>
      </section>

      {showChecklist ? (
        <GettingStarted
          steps={[
            {
              title: "Hire an agent",
              detail: "Pick a role and give it a name.",
              done: hasAgents,
              action: hireAgent,
              actionLabel: "Hire",
            },
            {
              title: "Set your first goal",
              detail: "Say what you want to achieve. Your lead agent plans the projects and tasks.",
              done: hasGoals || hasTasks,
              action: hasAgents
                ? () => {
                    setChosenMode("goal");
                    composerRef.current?.focus();
                  }
                : hireAgent,
              actionLabel: "Set a goal",
            },
            {
              title: "Review the result",
              detail: "Finished work shows up here and in your inbox.",
              done: hasResults,
              to: "/issues",
              actionLabel: "See tasks",
            },
          ]}
        />
      ) : null}

      {hasAgents && goalOverview ? <GoalsCard overview={goalOverview} onStart={() => { setChosenMode("goal"); composerRef.current?.focus(); }} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <NeedsYouCard approvals={pendingApprovals} blocked={dashboard?.tasks.blocked ?? 0} incidents={dashboard?.budgets.activeIncidents ?? 0} />
        <TeamCard agents={visibleAgents} runningByAgent={runningByAgent} loading={agentsLoading} onHire={hireAgent} />
        <RecentWorkCard issues={recentIssues ?? []} loading={issuesLoading} onCreate={() => (hasAgents ? composerRef.current?.focus() : hireAgent())} />
      </div>
    </div>
  );
}

function StatPill({ to, children, dotClass }: { to: string; children: ReactNode; dotClass?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 font-medium text-foreground/80 no-underline shadow-xs backdrop-blur transition-colors hover:bg-card hover:text-foreground"
    >
      {dotClass ? <span className={cn("h-2 w-2 rounded-full", dotClass)} aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

interface ChecklistStep {
  title: string;
  detail: string;
  done: boolean;
  actionLabel: string;
  action?: () => void;
  to?: string;
}

function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);
  return (
    <section aria-labelledby="home-getting-started" className="rounded-2xl border bg-card p-5 shadow-xs md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 id="home-getting-started" className="text-base font-semibold">Get set up</h2>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{doneCount} of {steps.length} done</span>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => {
          const isNext = index === nextIndex;
          const actionClass = "mt-auto self-start";
          return (
            <li
              key={step.title}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
                step.done ? "bg-muted/40" : isNext ? "border-ring/40 bg-brand-soft/40" : "bg-card",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.done ? "bg-tint-mint text-tint-mint-foreground" : isNext ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", step.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </div>
              {!step.done ? (
                step.to ? (
                  <Button asChild size="sm" variant={isNext ? "default" : "outline"} className={actionClass}>
                    <Link to={step.to}>{step.actionLabel}</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant={isNext ? "default" : "outline"} className={actionClass} onClick={step.action}>
                    {step.actionLabel}
                  </Button>
                )
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function HomeCard({
  title,
  icon: Icon,
  iconClass,
  count,
  footer,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  count?: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center gap-3 px-5 pt-5">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        {count != null && count > 0 ? (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{count}</span>
        ) : null}
      </header>
      <div className="flex flex-1 flex-col px-3 py-3">{children}</div>
      {footer ? <footer className="border-t px-5 py-3">{footer}</footer> : null}
    </section>
  );
}

function CardEmpty({ icon: Icon, iconClass, title, message, action }: { icon: LucideIcon; iconClass: string; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <span className={cn("mb-1 flex h-14 w-14 items-center justify-center rounded-2xl", iconClass)}>
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm text-inherit no-underline transition-colors hover:bg-accent"
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-brand-soft-foreground no-underline hover:underline">
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function NeedsYouCard({ approvals, blocked, incidents }: { approvals: Approval[]; blocked: number; incidents: number }) {
  const total = approvals.length + blocked + incidents;
  return (
    <HomeCard
      title="Needs you"
      icon={InboxIcon}
      iconClass="bg-tint-peach text-tint-peach-foreground"
      count={total}
      footer={<FooterLink to="/inbox">Open inbox</FooterLink>}
    >
      {total === 0 ? (
        <CardEmpty
          icon={PartyPopper}
          iconClass="bg-tint-mint text-tint-mint-foreground"
          title="You're all caught up"
          message="When an agent needs a decision or gets stuck, it will show up right here."
        />
      ) : (
        <div className="flex flex-col">
          {approvals.slice(0, 4).map((approval) => (
            <RowLink key={approval.id} to={`/approvals/${approval.id}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{approvalLabel(approval.type, approval.payload)}</span>
                <span className="block text-xs text-muted-foreground">Waiting for your OK · {timeAgo(approval.createdAt)}</span>
              </span>
            </RowLink>
          ))}
          {blocked > 0 ? (
            <RowLink to="/inbox/blocked">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-rose text-tint-rose-foreground">
                <ListTodo className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{blocked} task{blocked === 1 ? " is" : "s are"} stuck</span>
                <span className="block text-xs text-muted-foreground">An agent needs help to continue</span>
              </span>
            </RowLink>
          ) : null}
          {incidents > 0 ? (
            <RowLink to="/costs">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-peach text-tint-peach-foreground">
                <PauseCircle className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">Budget limit reached</span>
                <span className="block text-xs text-muted-foreground">Some work is paused until you review spending</span>
              </span>
            </RowLink>
          ) : null}
        </div>
      )}
    </HomeCard>
  );
}

function TeamCard({
  agents,
  runningByAgent,
  loading,
  onHire,
}: {
  agents: Agent[];
  runningByAgent: Map<string, string | null>;
  loading: boolean;
  onHire: () => void;
}) {
  const sorted = [...agents].sort((a, b) => Number(runningByAgent.has(b.id)) - Number(runningByAgent.has(a.id)));
  return (
    <HomeCard
      title="Your team"
      icon={Users}
      iconClass="bg-brand-soft text-brand-soft-foreground"
      footer={
        agents.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <FooterLink to="/agents/all">See everyone</FooterLink>
            <button type="button" onClick={onHire} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              + Hire
            </button>
          </div>
        ) : null
      }
    >
      {agents.length === 0 && !loading ? (
        <CardEmpty
          icon={UserPlus}
          iconClass="bg-brand-soft text-brand-soft-foreground"
          title="No agents yet"
          message="Agents are AI teammates that take on tasks for you: research, writing, coding, and more."
          action={<Button size="sm" onClick={onHire}>Hire an agent</Button>}
        />
      ) : (
        <div className="flex flex-col">
          {sorted.slice(0, 5).map((agent) => {
            const running = runningByAgent.has(agent.id);
            const status = FRIENDLY_AGENT_STATUS[running ? "running" : agent.status] ?? FRIENDLY_AGENT_STATUS.idle;
            const workingOn = runningByAgent.get(agent.id);
            return (
              <RowLink key={agent.id} to={agentUrl(agent)}>
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-soft-foreground">
                  <AgentIcon icon={agent.icon} className="h-4 w-4" />
                  {running ? (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-status-running" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{agent.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {running && workingOn ? `Working on "${workingOn}"` : agent.title || "Agent"}
                  </span>
                </span>
                <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", status.tone)}>{status.label}</span>
              </RowLink>
            );
          })}
        </div>
      )}
    </HomeCard>
  );
}

function RecentWorkCard({ issues, loading, onCreate }: { issues: Issue[]; loading: boolean; onCreate: () => void }) {
  return (
    <HomeCard
      title="Recent work"
      icon={ListTodo}
      iconClass="bg-tint-sky text-tint-sky-foreground"
      footer={issues.length > 0 ? <FooterLink to="/issues">All tasks</FooterLink> : null}
    >
      {issues.length === 0 && !loading ? (
        <CardEmpty
          icon={ListTodo}
          iconClass="bg-tint-sky text-tint-sky-foreground"
          title="No tasks yet"
          message="Describe what you need above and your agents will take it from there."
          action={<Button size="sm" variant="outline" onClick={onCreate}>Write your first task</Button>}
        />
      ) : (
        <div className="flex flex-col">
          {issues.slice(0, 5).map((issue) => (
            <RowLink key={issue.id} to={issueUrl(issue)}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <StatusIcon status={issue.status} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{issue.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {FRIENDLY_TASK_STATUS[issue.status] ?? issue.status} · {timeAgo(issue.updatedAt)}
                </span>
              </span>
            </RowLink>
          ))}
        </div>
      )}
    </HomeCard>
  );
}

function GoalsCard({ overview, onStart }: { overview: GoalOverview; onStart: () => void }) {
  const goals = overview.goals
    .filter((entry) => entry.goal.status === "active" || entry.goal.status === "planned")
    .filter((entry) => !entry.goal.parentId || !overview.goals.some((other) => other.goal.id === entry.goal.parentId))
    .slice(0, 4);
  return (
    <section aria-labelledby="home-goals" className="rounded-2xl border bg-card shadow-xs" data-testid="home-goals">
      <header className="flex items-center gap-3 px-5 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <Target className="h-4 w-4" />
        </span>
        <h2 id="home-goals" className="text-base font-semibold">Your goals</h2>
        {overview.summary.goalsAtRisk > 0 ? (
          <span className="ml-auto rounded-full bg-tint-peach px-2 py-0.5 text-xs font-medium text-tint-peach-foreground">
            {overview.summary.goalsAtRisk} at risk
          </span>
        ) : null}
      </header>
      {goals.length === 0 ? (
        <CardEmpty
          icon={Target}
          iconClass="bg-brand-soft text-brand-soft-foreground"
          title="No goals yet"
          message="Everything your agents do should move a goal forward. Set one and your lead agent will plan the work."
          action={<Button size="sm" onClick={onStart}>Set a goal</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 px-3 py-3 md:grid-cols-2">
          {goals.map((entry) => (
            <Link
              key={entry.goal.id}
              to={`/goals/${entry.goal.id}`}
              className="flex min-w-0 flex-col gap-2 rounded-xl px-3 py-3 text-sm text-inherit no-underline transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{entry.goal.title}</span>
                <WorkHealthPill progress={entry.progress} />
              </span>
              <WorkProgressBar progress={entry.progress} size="sm" />
              <span className="text-xs text-muted-foreground">
                {entry.goal.horizon ? `${GOAL_HORIZON_LABEL[entry.goal.horizon]} · ` : ""}
                {entry.projectIds.length} project{entry.projectIds.length === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
      <footer className="flex items-center justify-between gap-3 border-t px-5 py-3">
        <FooterLink to="/goals">All goals</FooterLink>
        <span className="text-xs text-muted-foreground">
          {overview.summary.completedLast7Days} task{overview.summary.completedLast7Days === 1 ? "" : "s"} finished this week
        </span>
      </footer>
    </section>
  );
}
