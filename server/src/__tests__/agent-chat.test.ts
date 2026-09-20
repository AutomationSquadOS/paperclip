import { describe, expect, it } from "vitest";
import {
  agentChatBlockMessage,
  resolveAgentChatBlockReason,
  shouldIncludeAgentChatIssues,
} from "../services/agent-chat.ts";

describe("agent chat helpers", () => {
  it("blocks paused, pending, terminated, and invalid org chain agents", () => {
    expect(resolveAgentChatBlockReason({ status: "pending_approval" })).toBe("pending_approval");
    expect(resolveAgentChatBlockReason({ status: "terminated" })).toBe("terminated");
    expect(resolveAgentChatBlockReason({ status: "paused", pauseReason: null })).toBe("paused");
    expect(resolveAgentChatBlockReason({ status: "paused", pauseReason: "budget" })).toBe("budget_paused");
    expect(
      resolveAgentChatBlockReason({
        status: "idle",
        orgChainHealth: { status: "invalid_org_chain" },
      }),
    ).toBe("invalid_org_chain");
    expect(resolveAgentChatBlockReason({ status: "idle" })).toBeNull();
    expect(resolveAgentChatBlockReason({ status: "error" })).toBe("error");
  });

  it("returns operator-facing block messages", () => {
    expect(agentChatBlockMessage("paused")).toContain("paused");
    expect(agentChatBlockMessage("budget_paused")).toContain("budget");
  });

  it("only includes agent-chat issues when explicitly requested", () => {
    expect(shouldIncludeAgentChatIssues(undefined)).toBe(false);
    expect(shouldIncludeAgentChatIssues({})).toBe(false);
    expect(shouldIncludeAgentChatIssues({ originKind: "manual" })).toBe(false);
    expect(shouldIncludeAgentChatIssues({ originKind: "agent_chat" })).toBe(true);
    expect(shouldIncludeAgentChatIssues({ includeAgentChat: true })).toBe(true);
  });
});
