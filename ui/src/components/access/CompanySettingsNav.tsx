import { PageTabBar } from "@/components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { useLocation, useNavigate } from "@/lib/router";

const companyItems = [
  { value: "general", label: "General", href: "/company/settings" },
  { value: "members", label: "Members", href: "/company/settings/members" },
  { value: "invites", label: "Invites", href: "/company/settings/invites" },
  { value: "secrets", label: "Secrets", href: "/company/settings/secrets" },
  { value: "cloud-upstream", label: "Hosting", href: "/company/settings/cloud-upstream" },
] as const;

const instanceItems = [
  { value: "instance-profile", label: "Profile", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/profile` },
  { value: "instance-general", label: "General", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/general` },
  { value: "instance-environments", label: "Environments", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/environments` },
  { value: "instance-access", label: "Access", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/access` },
  { value: "instance-heartbeats", label: "Heartbeats", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/heartbeats` },
  { value: "instance-plugins", label: "Plugins", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/plugins` },
  { value: "instance-adapters", label: "Adapters", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/adapters` },
  { value: "instance-experimental", label: "Experimental", href: `${INSTANCE_SETTINGS_PATH_PREFIX}/experimental` },
] as const;

const items = [...companyItems, ...instanceItems] as const;

type CompanySettingsTab = (typeof items)[number]["value"];

export function getCompanySettingsTab(pathname: string): CompanySettingsTab {
  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/profile`)) {
    return "instance-profile";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/access`)) {
    return "instance-access";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/environments`)) {
    return "instance-environments";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/heartbeats`)) {
    return "instance-heartbeats";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/experimental`)) {
    return "instance-experimental";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/plugins`)) {
    return "instance-plugins";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/adapters`)) {
    return "instance-adapters";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/general`)) {
    return "instance-general";
  }

  if (pathname.includes("/company/settings/environments")) {
    return "instance-environments";
  }

  if (pathname.includes("/company/settings/cloud-upstream")) {
    return "cloud-upstream";
  }

  if (pathname.includes("/company/settings/members") || pathname.includes("/company/settings/access")) {
    return "members";
  }

  if (pathname.includes("/company/settings/invites")) {
    return "invites";
  }

  if (pathname.includes("/company/settings/secrets")) {
    return "secrets";
  }

  return "general";
}

export function CompanySettingsNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getCompanySettingsTab(location.pathname);

  function handleTabChange(value: string) {
    const nextTab = items.find((item) => item.value === value);
    if (!nextTab || nextTab.value === activeTab) return;
    navigate(nextTab.href);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</p>
          <PageTabBar
            items={companyItems.map(({ value, label }) => ({ value, label }))}
            value={activeTab}
            onValueChange={handleTabChange}
            align="start"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instance</p>
          <PageTabBar
            items={instanceItems.map(({ value, label }) => ({ value, label }))}
            value={activeTab}
            onValueChange={handleTabChange}
            align="start"
          />
        </div>
      </div>
    </Tabs>
  );
}
