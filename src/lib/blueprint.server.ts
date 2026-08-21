import { generateText } from "ai";
import { getAiModel } from "@/lib/ai-gateway.server";

export type BlueprintFacts = {
  name: string;
  goal: string;
  frame: string;
  bmi: number;
  weight: number | null;
  goalWeight: number | null;
  gymDays: number;
  targetCalories: number | null;
  targetProtein: number | null;
  avgCalories: number | null;
  avgProtein: number | null;
  daysLogged: number;
  trainedDays: number;
  weightChangeKg: number | null;
};

export async function generateBlueprintText(facts: BlueprintFacts) {
  const { text } = await generateText({
    model: getAiModel("gemini-3.6-flash"),
    system: [
      "You are Gymie, a blunt, warm strength and physique coach for a user in Bangladesh.",
      "The user is slim and wants to build lean muscle. Write for them personally, second person.",
      "Output 4 to 5 short bullet points, each starting with '- ' and one bold lead phrase in **markdown**.",
      "Every bullet must reference their actual numbers and name a concrete next action.",
      "Cover: eating (use cheap Bangladeshi foods like milk, eggs, bhat, dal, chicken, peanut butter),",
      "training consistency, and one style or recovery tip. No preamble, no closing line, bullets only.",
    ].join(" "),
    prompt: JSON.stringify(facts),
  });

  return text.trim();
}
