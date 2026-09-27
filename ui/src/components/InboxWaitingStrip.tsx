import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, PauseCircle, Scale, type LucideIcon } from "lucide-react";
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {decisionCount > 0 ? (
        <WaitingCard to="/decisions" icon={Scale} tone="bg-brand-soft text-brand-soft-foreground" title="Decisions">
          {decisionCount} waiting
        </WaitingCard>
      ) : null}
      {approvalCount > 0 ? (
        <WaitingCard to="/approvals/pending" icon={CheckCircle2} tone="bg-tint-peach text-tint-peach-foreground" title="Approvals">
          {approvalCount} waiting
        </WaitingCard>
      ) : null}
      {incidentCount > 0 ? (
        <WaitingCard to="/costs" icon={PauseCircle} tone="bg-tint-rose text-tint-rose-foreground" title="Budget">
          {incidentCount} incident{incidentCount === 1 ? "" : "s"}
        </WaitingCard>
      ) : null}
    </div>
  );
}

function WaitingCard({
  to,
  icon: Icon,
  tone,
  title,
  children,
}: {
  to: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-inherit no-underline shadow-xs transition-shadow hover:shadow-md"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-muted-foreground">{children}</span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
