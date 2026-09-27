import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { usePublishSharedQueryData, useSharedPollingQuery } from "../hooks/useSharedPolling";
import { formatCents } from "../lib/utils";
import { LayoutDashboard, PauseCircle } from "lucide-react";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const dashboardQueryKey = queryKeys.dashboard(selectedCompanyId!);
  const sharedDashboard = useSharedPollingQuery({
    companyId: selectedCompanyId,
    resourceKey: "dashboard",
    queryKey: dashboardQueryKey,
    enabled: !!selectedCompanyId,
  });
  const { data, isLoading, error, dataUpdatedAt: dashboardUpdatedAt } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  usePublishSharedQueryData(sharedDashboard, data, dashboardUpdatedAt);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents ? (
        <Button onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId })}>
          Add an agent
        </Button>
      ) : null}

      {data && data.budgets.activeIncidents > 0 ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
          <div className="flex items-start gap-2.5">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium">
                {data.budgets.activeIncidents} budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused
              </p>
            </div>
          </div>
          <Link to="/costs" className="text-sm font-medium underline underline-offset-2">
            Review budget
          </Link>
        </div>
      ) : null}

      {data ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/agents" className="font-medium text-foreground underline-offset-2 hover:underline">
            {data.agents.running} agents running
          </Link>
          {" · "}
          <Link to="/issues" className="font-medium text-foreground underline-offset-2 hover:underline">
            {data.tasks.open} open tasks
          </Link>
          {" · "}
          <Link to="/costs" className="font-medium text-foreground underline-offset-2 hover:underline">
            {formatCents(data.costs.monthSpendCents)} this month
          </Link>
        </p>
      ) : null}
    </div>
  );
}
