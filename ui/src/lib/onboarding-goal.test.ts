import { describe, expect, it } from "vitest";
import { parseOnboardingGoalInput } from "./onboarding-goal";

describe("parseOnboardingGoalInput", () => {
  it("uses a single-line goal as the title only", () => {
    expect(parseOnboardingGoalInput("Ship the MVP")).toEqual({
      title: "Ship the MVP",
      description: null,
    });
  });

  it("does not store a long brief as the company-goal title", () => {
    const brief =
      "launch a faceless youtube channel for BroncoBro.com that syndicates Classic Ford Broncos from a listing site and then creates captivating data driven videos with technicals, investment analysis, and a standardized workflow that runs on each newly posted listing once the existing backlog is caught up. Thumbnails, shorts, reels, and text posts for other platforms should be part of the same system.";
    const parsed = parseOnboardingGoalInput(brief);
    expect(parsed.title.length).toBeLessThan(120);
    expect(parsed.title).not.toEqual(brief);
    expect(parsed.description).toContain(brief);
  });

  it("splits a multiline goal into title and description", () => {
    expect(
      parseOnboardingGoalInput(
        "Ship the MVP\nLaunch to 10 design partners\nMeasure retention",
      ),
    ).toEqual({
      title: "Ship the MVP",
      description: "Launch to 10 design partners\nMeasure retention",
    });
  });
});
