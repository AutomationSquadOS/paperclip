import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "@paperclipai/shared";
import { attentionApi } from "../api/attention";
import { instanceSettingsApi } from "../api/instanceSettings";
import { useCompany } from "../context/CompanyContext";
import { attentionBadgeCount } from "../lib/attention";
import { queryKeys } from "../lib/queryKeys";

export function InboxWaitingStrip({ dashboard }: { dashboard: DashboardSummary | undefined }) {
  const { selectedCompanyId } = useCompany();
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const showDecisions = experimentalSettings?.enableDecisions === true;
  const { data: attentionFeed } = useQuery({
    queryKey: queryKeys.attention(selectedCompanyId!),
    queryFn: () => attentionApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && showDecisions,
    refetchInterval: 60_000,
  });
  const decisionCount = showDecisions ? attentionBadgeCount(attentionFeed) : 0;
  const approvalCount = dashboard?.pendingApprovals ?? 0;
  const incidentCount = dashboard?.budgets?.activeIncidents ?? 0;

  if (decisionCount === 0 && approvalCount === 0 && incidentCount === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {decisionCount > 0 ? (
        <Link
          to="/decisions"
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm no-underline text-inherit hover:bg-accent/50"
        >
          <span className="font-medium">Decisions</span>
          <span className="text-muted-foreground">{decisionCount} waiting</span>
        </Link>
      ) : null}
      {approvalCount > 0 ? (
        <Link
          to="/approvals/pending"
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm no-underline text-inherit hover:bg-accent/50"
        >
          <span className="font-medium">Approvals</span>
          <span className="text-muted-foreground">{approvalCount} waiting</span>
        </Link>
      ) : null}
      {incidentCount > 0 ? (
        <Link
          to="/costs"
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm no-underline text-inherit hover:bg-accent/50"
        >
          <span className="font-medium">Budget</span>
          <span className="text-muted-foreground">
            {incidentCount} incident{incidentCount === 1 ? "" : "s"}
          </span>
        </Link>
      ) : null}
    </div>
  );
}
