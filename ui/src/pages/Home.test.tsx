// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const mockAgentsApi = vi.hoisted(() => ({ list: vi.fn() }));
const mockApprovalsApi = vi.hoisted(() => ({ list: vi.fn() }));
const mockAuthApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const mockDashboardApi = vi.hoisted(() => ({ summary: vi.fn() }));
const mockHeartbeatsApi = vi.hoisted(() => ({ liveRunsForCompany: vi.fn() }));
const mockIssuesApi = vi.hoisted(() => ({ list: vi.fn() }));
const mockOpenNewIssue = vi.hoisted(() => vi.fn());
const mockOpenOnboarding = vi.hoisted(() => vi.fn());

vi.mock("@/lib/router", () => ({
  Link: ({ children, to, ...props }: { children?: ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", name: "Northwind Studio", issuePrefix: "NOR" },
    companies: [{ id: "company-1" }],
  }),
}));
vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openNewIssue: mockOpenNewIssue, openOnboarding: mockOpenOnboarding }),
}));
vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));
vi.mock("../api/agents", () => ({ agentsApi: mockAgentsApi }));
vi.mock("../api/approvals", () => ({ approvalsApi: mockApprovalsApi }));
vi.mock("../api/auth", () => ({ authApi: mockAuthApi }));
vi.mock("../api/dashboard", () => ({ dashboardApi: mockDashboardApi }));
vi.mock("../api/heartbeats", () => ({ heartbeatsApi: mockHeartbeatsApi }));
vi.mock("../api/issues", () => ({ issuesApi: mockIssuesApi }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dashboard = {
  companyId: "company-1",
  agents: { active: 1, running: 0, paused: 0, error: 0 },
  tasks: { open: 2, inProgress: 1, blocked: 0, done: 3 },
  costs: { monthSpendCents: 1234, monthBudgetCents: 0, monthUtilizationPercent: 0 },
  pendingApprovals: 1,
  budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [],
};

function agent(overrides: Record<string, unknown>) {
  return { id: "agent-1", name: "Ava", urlKey: "ava", role: "ceo", title: "Chief of staff", icon: null, status: "idle", metadata: null, ...overrides };
}

describe("Home", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthApi.getSession.mockResolvedValue({ user: { id: "u1", name: "Rob MacKelfresh" } });
    mockDashboardApi.summary.mockResolvedValue(dashboard);
    mockHeartbeatsApi.liveRunsForCompany.mockResolvedValue([]);
    mockApprovalsApi.list.mockResolvedValue([
      { id: "approval-1", type: "hire_agent", status: "pending", payload: { name: "Nova" }, createdAt: new Date().toISOString() },
    ]);
    mockIssuesApi.list.mockResolvedValue([
      { id: "issue-1", identifier: "NOR-1", title: "Draft the launch announcement", status: "in_review", updatedAt: new Date().toISOString() },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Home />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("greets the user and shows what needs them, their agents, and recent work", async () => {
    mockAgentsApi.list.mockResolvedValue([
      agent({}),
      agent({ id: "agent-2", name: "Summarizer", metadata: { paperclipBuiltInAgent: { key: "summarizer" } } }),
    ]);
    await render();

    const text = container.textContent ?? "";
    expect(text).toMatch(/Good (morning|afternoon|evening), Rob|Working late, Rob/);
    expect(text).toContain("Needs you");
    expect(text).toContain("Hire Agent: Nova");
    expect(text).toContain("Your team");
    expect(text).toContain("Ava");
    expect(text).not.toContain("Summarizer");
    expect(text).toContain("Draft the launch announcement");
    expect(text).toContain("Ready for review");
    expect(text).not.toContain("Get set up");
  });

  it("turns the composer text into a new task", async () => {
    mockAgentsApi.list.mockResolvedValue([agent({})]);
    await render();

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(textarea, "Plan the fall campaign");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(mockOpenNewIssue).toHaveBeenCalledWith({ title: "Plan the fall campaign" });
  });

  it("guides a brand-new company to hire its first agent", async () => {
    mockAgentsApi.list.mockResolvedValue([]);
    mockDashboardApi.summary.mockResolvedValue({
      ...dashboard,
      tasks: { open: 0, inProgress: 0, blocked: 0, done: 0 },
      pendingApprovals: 0,
    });
    mockApprovalsApi.list.mockResolvedValue([]);
    mockIssuesApi.list.mockResolvedValue([]);
    await render();

    const text = container.textContent ?? "";
    expect(text).toContain("Get set up");
    expect(text).toContain("0 of 3 done");
    expect(text).toContain("You're all caught up");
    expect(text).toContain("No agents yet");
    expect(container.querySelector("textarea")).toBeNull();

    const hireButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Hire your first agent"));
    await act(async () => {
      hireButton?.click();
    });
    expect(mockOpenOnboarding).toHaveBeenCalledWith({ initialStep: 2, companyId: "company-1" });
  });
});
