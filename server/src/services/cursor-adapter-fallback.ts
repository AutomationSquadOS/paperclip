import { spawnSync } from "node:child_process";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { agentRuntimeState, agents, issues, type Db } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

const CURSOR_ADAPTER_TYPES = ["cursor", "cursor_cloud"] as const;
const CLAUDE_FALLBACK_MODEL = "claude-sonnet-4-6";
const RETRYABLE_ISSUE_STATUSES = ["todo", "in_progress", "blocked"] as const;

export function cursorCliIsAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const probe = spawnSync("sh", ["-c", "command -v agent || command -v cursor-agent"], {
    encoding: "utf8",
    env,
    timeout: 5_000,
  });
  return probe.status === 0 && probe.stdout.trim().length > 0;
}

export function shouldFallbackCursorAdapters(env: NodeJS.ProcessEnv = process.env): boolean {
  const forced = env.PAPERCLIP_FALLBACK_CURSOR_TO_CLAUDE === "1";
  if (forced) return true;
  return !cursorCliIsAvailable(env);
}

export function buildClaudeFallbackAdapterConfig(
  adapterConfig: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(adapterConfig ?? {}) };
  const model = typeof next.model === "string" ? next.model.trim() : "";
  const looksLikeClaude =
    /claude|sonnet|opus|haiku|fable|mythos/i.test(model);
  next.model = looksLikeClaude ? model : CLAUDE_FALLBACK_MODEL;
  next.command = "claude";
  if (next.mode === "plan" || next.mode === "ask") {
    delete next.mode;
  }
  return next;
}

export interface CursorAdapterFallbackSummary {
  remapped: number;
  skipped: boolean;
  agentIds: string[];
}

export async function reconcileCursorAdapterFallbackOnStartup(
  db: Db,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CursorAdapterFallbackSummary> {
  if (!shouldFallbackCursorAdapters(env)) {
    return { remapped: 0, skipped: true, agentIds: [] };
  }

  const cursorAgents = await db
    .select({
      id: agents.id,
      companyId: agents.companyId,
      adapterConfig: agents.adapterConfig,
    })
    .from(agents)
    .where(inArray(agents.adapterType, [...CURSOR_ADAPTER_TYPES]));

  if (cursorAgents.length === 0) {
    return { remapped: 0, skipped: false, agentIds: [] };
  }

  const now = new Date();
  for (const agent of cursorAgents) {
    const nextConfig = buildClaudeFallbackAdapterConfig(agent.adapterConfig);
    await db
      .update(agents)
      .set({
        adapterType: "claude_local",
        adapterConfig: nextConfig,
        errorReason: null,
        updatedAt: now,
      })
      .where(eq(agents.id, agent.id));

    await db
      .update(agentRuntimeState)
      .set({
        adapterType: "claude_local",
        sessionId: null,
        lastError: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentRuntimeState.agentId, agent.id),
          eq(agentRuntimeState.companyId, agent.companyId),
        ),
      );
  }

  const assigned = await db
    .select({
      id: issues.id,
      assigneeAgentId: issues.assigneeAgentId,
      status: issues.status,
    })
    .from(issues)
    .where(
      and(
        inArray(
          issues.assigneeAgentId,
          cursorAgents.map((agent) => agent.id),
        ),
        inArray(issues.status, [...RETRYABLE_ISSUE_STATUSES]),
        isNotNull(issues.assigneeAgentId),
      ),
    );

  logger.warn(
    {
      remapped: cursorAgents.length,
      agentIds: cursorAgents.map((agent) => agent.id),
      assignedIssues: assigned.length,
    },
    "Cursor CLI is unavailable on this host; remapped cursor agents to Claude Code so assigned work can run",
  );

  return {
    remapped: cursorAgents.length,
    skipped: false,
    agentIds: cursorAgents.map((agent) => agent.id),
  };
}
