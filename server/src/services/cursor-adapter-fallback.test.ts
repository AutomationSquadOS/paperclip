import { describe, expect, it } from "vitest";
import {
  buildClaudeFallbackAdapterConfig,
  shouldFallbackCursorAdapters,
} from "./cursor-adapter-fallback.js";

describe("cursor adapter fallback", () => {
  it("keeps a Claude model and drops Cursor-only mode", () => {
    expect(
      buildClaudeFallbackAdapterConfig({
        model: "claude-opus-4-6",
        mode: "plan",
        command: "agent",
      }),
    ).toEqual({
      model: "claude-opus-4-6",
      command: "claude",
    });
  });

  it("replaces Cursor auto with a Claude default", () => {
    expect(buildClaudeFallbackAdapterConfig({ model: "auto" })).toEqual({
      model: "claude-sonnet-4-6",
      command: "claude",
    });
  });

  it("falls back when the host asks for it", () => {
    expect(shouldFallbackCursorAdapters({ PAPERCLIP_FALLBACK_CURSOR_TO_CLAUDE: "1" })).toBe(true);
  });
});
