import { isLongBrief, resolveGoalIntake } from "@paperclipai/shared";

export function parseOnboardingGoalInput(raw: string): {
  title: string;
  description: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { title: "", description: null };
  }

  if (isLongBrief(trimmed)) {
    const intake = resolveGoalIntake({ title: trimmed, kind: "brief" });
    return {
      title: intake.title,
      description: intake.description,
    };
  }

  const [firstLine, ...restLines] = trimmed.split(/\r?\n/);
  const title = firstLine.trim();
  const description = restLines.join("\n").trim();

  return {
    title,
    description: description.length > 0 ? description : null,
  };
}
