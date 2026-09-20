import { and, desc, eq, isNull, ne, notInArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueLabels, issues, labels } from "@paperclipai/db";
import {
  AGENT_CHAT_LABEL_NAME,
  AGENT_CHAT_ORIGIN_KIND,
} from "@paperclipai/shared";
import { conflict, notFound } from "../errors.js";
import { agentService } from "./agents.js";
import { issueService } from "./issues.js";

const AGENT_CHAT_LABEL_COLOR = "zinc";
const TERMINAL_ISSUE_STATUSES = ["done", "cancelled"] as const;

export type AgentChatBlockReason =
  | "pending_approval"
  | "paused"
  | "terminated"
  | "budget_paused"
  | "error"
  | "invalid_org_chain";

function chatTitleForAgent(agentName: string) {
  return `Chat with ${agentName}`;
}

function chatDescriptionForAgent(agentName: string) {
  return [
    `Standing board conversation with ${agentName}.`,
    "",
    "This issue backs the Agent Detail Chat tab. Prefer creating or linking",
    "real task issues when the conversation becomes durable work — keep this",
    "thread for operator dialogue, clarifications, and light follow-ups.",
  ].join("\n");
}

export function resolveAgentChatBlockReason(agent: {
  status: string;
  pauseReason?: string | null;
  orgChainHealth?: { status?: string | null } | null;
}): AgentChatBlockReason | null {
  if (agent.orgChainHealth?.status === "invalid_org_chain") return "invalid_org_chain";
  if (agent.status === "pending_approval") return "pending_approval";
  if (agent.status === "terminated") return "terminated";
  if (agent.status === "paused") {
    return agent.pauseReason === "budget" || agent.pauseReason === "budget_hard_stop"
      ? "budget_paused"
      : "paused";
  }
  if (agent.status === "error") return "error";
  return null;
}

export function agentChatBlockMessage(reason: AgentChatBlockReason): string {
  switch (reason) {
    case "pending_approval":
      return "This agent is pending board approval and cannot be messaged yet.";
    case "paused":
      return "This agent is paused. Resume it before chatting.";
    case "budget_paused":
      return "This agent is paused for budget. Adjust the budget or resume before chatting.";
    case "terminated":
      return "This agent is terminated and cannot be messaged.";
    case "error":
      return "This agent is in an error state. Clear the error before chatting.";
    case "invalid_org_chain":
      return "Repair this agent's reporting chain before chatting.";
  }
}

async function ensureAgentChatLabel(db: Db, companyId: string): Promise<string> {
  const existing = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.companyId, companyId), eq(labels.name, AGENT_CHAT_LABEL_NAME)))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing.id;

  try {
    const [created] = await db
      .insert(labels)
      .values({
        companyId,
        name: AGENT_CHAT_LABEL_NAME,
        color: AGENT_CHAT_LABEL_COLOR,
      })
      .returning({ id: labels.id });
    if (created) return created.id;
  } catch {
    // Concurrent create — fall through to re-select.
  }

  const again = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.companyId, companyId), eq(labels.name, AGENT_CHAT_LABEL_NAME)))
    .then((rows) => rows[0] ?? null);
  if (!again) throw new Error("Failed to ensure agent-chat label");
  return again.id;
}

export function agentChatService(db: Db) {
  const issuesSvc = issueService(db);
  const agentsSvc = agentService(db);

  async function findOpenConversationIssue(companyId: string, agentId: string) {
    return db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.originKind, AGENT_CHAT_ORIGIN_KIND),
          eq(issues.originId, agentId),
          isNull(issues.hiddenAt),
          notInArray(issues.status, [...TERMINAL_ISSUE_STATUSES]),
        ),
      )
      .orderBy(desc(issues.createdAt), desc(issues.id))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  return {
    getConversationIssue: async (agentId: string) => {
      const agent = await agentsSvc.getById(agentId);
      if (!agent) throw notFound("Agent not found");

      const issue = await findOpenConversationIssue(agent.companyId, agent.id);
      if (!issue) {
        return {
          issue: null,
          created: false,
          agentId: agent.id,
          companyId: agent.companyId,
          blockReason: resolveAgentChatBlockReason(agent),
        };
      }

      const enriched = await issuesSvc.getById(issue.id);
      return {
        issue: enriched ?? issue,
        created: false,
        agentId: agent.id,
        companyId: agent.companyId,
        blockReason: resolveAgentChatBlockReason(agent),
      };
    },

    ensureConversationIssue: async (
      agentId: string,
      actor: {
        userId?: string | null;
      },
    ) => {
      const agent = await agentsSvc.getById(agentId);
      if (!agent) throw notFound("Agent not found");

      const blockReason = resolveAgentChatBlockReason(agent);
      if (
        blockReason === "pending_approval" ||
        blockReason === "terminated" ||
        blockReason === "paused" ||
        blockReason === "budget_paused" ||
        blockReason === "invalid_org_chain"
      ) {
        throw conflict(agentChatBlockMessage(blockReason));
      }

      const existing = await findOpenConversationIssue(agent.companyId, agent.id);
      if (existing) {
        const enriched = await issuesSvc.getById(existing.id);
        return {
          issue: enriched ?? existing,
          created: false,
          agentId: agent.id,
          companyId: agent.companyId,
          blockReason,
        };
      }

      const labelId = await ensureAgentChatLabel(db, agent.companyId);
      const created = await issuesSvc.create(agent.companyId, {
        title: chatTitleForAgent(agent.name),
        description: chatDescriptionForAgent(agent.name),
        status: "todo",
        priority: "medium",
        assigneeAgentId: agent.id,
        originKind: AGENT_CHAT_ORIGIN_KIND,
        originId: agent.id,
        createdByUserId: actor.userId ?? null,
        responsibleUserId: actor.userId ?? null,
        trustExplicitResponsibleUserId: Boolean(actor.userId),
        labelIds: [labelId],
        allowDuplicate: true,
      });

      if (created.assigneeAgentId !== agent.id) {
        const updated = await issuesSvc.update(created.id, { assigneeAgentId: agent.id });
        return {
          issue: updated ?? created,
          created: true,
          agentId: agent.id,
          companyId: agent.companyId,
          blockReason,
        };
      }

      const hasLabel = await db
        .select({ issueId: issueLabels.issueId })
        .from(issueLabels)
        .where(and(eq(issueLabels.issueId, created.id), eq(issueLabels.labelId, labelId)))
        .then((rows) => rows[0] ?? null);
      if (!hasLabel) {
        await db.insert(issueLabels).values({
          issueId: created.id,
          labelId,
          companyId: agent.companyId,
        }).onConflictDoNothing();
      }

      const enriched = await issuesSvc.getById(created.id);
      return {
        issue: enriched ?? created,
        created: true,
        agentId: agent.id,
        companyId: agent.companyId,
        blockReason,
      };
    },
  };
}

/** SQL fragment: hide standing agent-chat issues from default boards. */
export function nonAgentChatIssueCondition() {
  return ne(issues.originKind, AGENT_CHAT_ORIGIN_KIND);
}

export function shouldIncludeAgentChatIssues(filters: {
  includeAgentChat?: boolean;
  originKind?: string;
} | undefined) {
  return Boolean(
    filters?.includeAgentChat ||
    filters?.originKind === AGENT_CHAT_ORIGIN_KIND,
  );
}
