import type { GoalHorizon } from "./constants.js";

export const BRIEF_TITLE_MAX_CHARS = 90;
export const BRIEF_DETECT_MIN_CHARS = 180;
export const BRIEF_DETECT_MIN_WORDS = 40;

export type GoalIntakeKind = "goal" | "brief";

export type GoalRole = "company_goal" | "quarterly_priority";

export const GOAL_ROLE_LABEL: Record<GoalRole, string> = {
  company_goal: "Company goal",
  quarterly_priority: "This-quarter priority",
};

export interface ResolvedGoalIntake {
  kind: GoalIntakeKind;
  /** Short, measurable company-goal title. Never the raw essay. */
  title: string;
  /** Full brief (or short goal description). */
  description: string | null;
  /** Original pasted text when this came from a brief. */
  brief: string | null;
  /** Company-goal timeframe. Briefs default to this year. Short goals keep the operator's pick. */
  companyHorizon: GoalHorizon | null;
  /** 1–3 this-quarter priorities to create under the company goal. */
  quarterlyPriorities: string[];
  /** Starter project name, or null for a short goal. */
  projectName: string | null;
}

export function goalRoleFromHorizon(horizon: string | null | undefined): GoalRole {
  return horizon === "quarter" ? "quarterly_priority" : "company_goal";
}

export function isLongBrief(text: string | null | undefined): boolean {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return false;
  if (trimmed.length >= BRIEF_DETECT_MIN_CHARS) return true;
  if (trimmed.split(/\s+/).filter(Boolean).length >= BRIEF_DETECT_MIN_WORDS) return true;
  if ((trimmed.match(/[.!?](\s|$)/g) ?? []).length >= 3) return true;
  return /\n\s*\n/.test(trimmed);
}

export function extractBrandName(text: string): string | null {
  const host = text.match(/\b([a-z0-9-]+)\.(com|ai|io|co|net|org|tv)\b/i);
  if (host?.[1]) return titleCaseToken(host[1].replace(/-/g, " "));
  const labeled = text.match(/\bfor\s+([A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)+)\b/);
  if (labeled?.[1]) return labeled[1];
  return null;
}

export function deriveGoalTitleFromBrief(text: string): string {
  const cleaned = stripUrls(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return "New company goal";
  const brand = extractBrandName(text);
  const first = firstSentence(cleaned);
  if (brand && /\b(launch|start|build|create|stand up)\b/i.test(first)) {
    const topic = inferTopic(first);
    const drafted = topic ? `Launch ${possessive(brand)} ${topic}` : `Launch ${brand}`;
    if (drafted.length <= BRIEF_TITLE_MAX_CHARS) return drafted;
  }
  return truncateTitle(capitalizeSentence(first));
}

export function deriveProjectNameFromBrief(text: string, goalTitle: string): string {
  const brand = extractBrandName(text);
  const topic = inferTopic(stripUrls(text)) ?? "launch";
  const name = brand ? `${brand} ${topic}` : goalTitle;
  return truncateTitle(name, 60);
}

export function deriveQuarterlyPriorities(text: string, goalTitle: string): string[] {
  const brand = extractBrandName(text);
  const prefix = brand ? `${brand}: ` : "";
  const found: string[] = [];
  if (/\b(caught up|existing|backlog|already posted|already live)\b/i.test(text)) {
    found.push(`${prefix}Catch up the existing backlog`);
  }
  if (
    /\b(each newly|each new|every new|once the existing|standardized workflow|repeatable|on each|recurring)\b/i.test(
      text,
    )
  ) {
    found.push(`${prefix}Run the repeatable workflow this quarter`);
  }
  if (
    /\b(thumbnail|shorts|reels|tiktok|carousel|instagram|linkedin|pinterest|substack|medium|syndication|platforms)\b/i.test(
      text,
    )
  ) {
    found.push(`${prefix}Stand up thumbnails and multi-platform posts`);
  }
  if (found.length === 0) {
    found.push(truncateTitle(`${prefix}${goalTitle} this quarter`, 80));
  }
  return uniqueTitles(found).slice(0, 3);
}

export function buildGoalDescriptionFromBrief(brief: string): string {
  return [
    "**Started from a brief.** The title is a short draft of the company outcome. Keep the full idea below.",
    "",
    brief.trim(),
  ].join("\n");
}

export function resolveGoalIntake(input: {
  title: string;
  description?: string | null;
  kind?: GoalIntakeKind;
  horizon?: GoalHorizon | null;
}): ResolvedGoalIntake {
  const titleRaw = input.title.trim();
  const descriptionRaw = input.description?.trim() || null;
  const combined = descriptionRaw && descriptionRaw !== titleRaw ? `${titleRaw}\n\n${descriptionRaw}` : titleRaw;
  const asBrief = input.kind === "brief" || isLongBrief(titleRaw) || isLongBrief(combined);

  if (!asBrief) {
    return {
      kind: "goal",
      title: truncateTitle(titleRaw || "New goal"),
      description: descriptionRaw,
      brief: null,
      companyHorizon: input.horizon && input.horizon !== "quarter" ? input.horizon : input.horizon === "quarter" ? "quarter" : null,
      quarterlyPriorities: [],
      projectName: null,
    };
  }

  const brief = (descriptionRaw && isLongBrief(descriptionRaw) ? descriptionRaw : combined).trim();
  const title = isLongBrief(brief) ? deriveGoalTitleFromBrief(brief) : truncateTitle(brief);
  const quarterlyPriorities = deriveQuarterlyPriorities(brief, title);
  return {
    kind: "brief",
    title,
    description: buildGoalDescriptionFromBrief(brief),
    brief,
    companyHorizon: input.horizon === "long_term" ? "long_term" : "year",
    quarterlyPriorities,
    projectName: deriveProjectNameFromBrief(brief, title),
  };
}

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim();
}

function firstSentence(text: string): string {
  const match = text.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? text).trim();
}

function inferTopic(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\byoutube\b/.test(lower) && /\bchannel\b/.test(lower)) return "YouTube channel";
  if (/\byoutube\b/.test(lower)) return "YouTube syndication";
  if (/\bchannel\b/.test(lower)) return "channel";
  if (/\bwebsite\b|\bsite\b/.test(lower)) return "website";
  if (/\bpodcast\b/.test(lower)) return "podcast";
  return null;
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function titleCaseToken(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function capitalizeSentence(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncateTitle(value: string, max = BRIEF_TITLE_MAX_CHARS): string {
  const trimmed = value.replace(/[.,;:]+$/, "").trim();
  if (trimmed.length <= max) return trimmed;
  const sliced = trimmed.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(max * 0.45) ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trimEnd()}…`;
}

function uniqueTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const title of titles) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }
  return result;
}
