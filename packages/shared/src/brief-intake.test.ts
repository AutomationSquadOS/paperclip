import { describe, expect, it } from "vitest";
import {
  BRIEF_TITLE_MAX_CHARS,
  deriveGoalTitleFromBrief,
  deriveProjectNameFromBrief,
  deriveQuarterlyPriorities,
  extractBrandName,
  isLongBrief,
  resolveGoalIntake,
} from "./brief-intake.js";

const BRONCO_BRIEF =
  "launch a faceless youtube channel for BroncoBro.com that syndicates Classic Ford Broncos from: https://bringatrailer.com/ford/bronco-u13-u14-u15-1966-1977/ and then creates captivating, data driven videos with technicals, investment analysis and detailed engine, power, transmission, etc details on the rebuild and comps etc. This should be a standardized workflow that runs on each newly posted bronco in this category on Bringatrailer once the existing Broncos are caught up and run through it. The thumbnail for youtube should also be standardized, but should be a huge focus. Its critical that they are beautiful and appetizing and yield super high CTR with each videos target market. We also should produce other formats of the video for additional platforms and formats like youtube shorts, instagram reels, tiktok, etc in addition to image carousel creation for instagram posts, youtube community posts, linkedin, pinterest, tiktok, X.com (twitter), etc. I also want to create text posts for each syndication (parasite) platform that i'll eventually provide you, but we can start with the broncobro.com, X articles, linkedin articles, medium, substack, etc.";

describe("brief intake", () => {
  it("keeps a short quantitative sentence as a goal, not a brief", () => {
    expect(isLongBrief("Get our first 100 paying customers")).toBe(false);
    const intake = resolveGoalIntake({ title: "Get our first 100 paying customers" });
    expect(intake.kind).toBe("goal");
    expect(intake.title).toBe("Get our first 100 paying customers");
    expect(intake.brief).toBeNull();
    expect(intake.quarterlyPriorities).toEqual([]);
    expect(intake.projectName).toBeNull();
  });

  it("treats the BroncoBro dump as a brief and never uses the essay as the title", () => {
    expect(isLongBrief(BRONCO_BRIEF)).toBe(true);
    const intake = resolveGoalIntake({ title: BRONCO_BRIEF });
    expect(intake.kind).toBe("brief");
    expect(intake.title.length).toBeLessThanOrEqual(BRIEF_TITLE_MAX_CHARS);
    expect(intake.title).not.toContain("bringatrailer.com");
    expect(intake.title.toLowerCase()).toContain("broncobro");
    expect(intake.brief).toBe(BRONCO_BRIEF);
    expect(intake.description).toContain(BRONCO_BRIEF);
    expect(intake.description).toContain("Started from a brief");
    expect(intake.companyHorizon).toBe("year");
    expect(intake.projectName).toMatch(/BroncoBro/i);
    expect(intake.quarterlyPriorities.length).toBeGreaterThanOrEqual(1);
    expect(intake.quarterlyPriorities.length).toBeLessThanOrEqual(3);
    expect(intake.quarterlyPriorities.join(" ")).toMatch(/backlog/i);
    expect(intake.quarterlyPriorities.join(" ")).toMatch(/workflow/i);
    expect(intake.quarterlyPriorities.join(" ")).toMatch(/thumbnail|platform/i);
  });

  it("promotes a long paste in Goal mode to a brief", () => {
    const intake = resolveGoalIntake({ title: BRONCO_BRIEF, kind: "goal" });
    expect(intake.kind).toBe("brief");
    expect(intake.title.length).toBeLessThan(BRONCO_BRIEF.length);
  });

  it("extracts a brand and drafts a short company-goal title", () => {
    expect(extractBrandName(BRONCO_BRIEF)).toBe("Broncobro");
    const title = deriveGoalTitleFromBrief(BRONCO_BRIEF);
    expect(title.length).toBeLessThanOrEqual(BRIEF_TITLE_MAX_CHARS);
    expect(title.toLowerCase()).toContain("broncobro");
    expect(deriveProjectNameFromBrief(BRONCO_BRIEF, title).toLowerCase()).toContain("broncobro");
    expect(deriveQuarterlyPriorities(BRONCO_BRIEF, title)).toHaveLength(3);
  });
});
