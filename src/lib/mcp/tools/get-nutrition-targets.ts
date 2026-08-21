import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_nutrition_targets",
  title: "Get nutrition targets",
  description:
    "Get the signed-in user's Gymie profile: biometrics, goal, and daily calorie, protein, carb, fat and water targets.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "name, age, gender, height_cm, weight_kg, goal_weight_kg, activity_level, gym_days_per_week, daily_steps, goal, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_water_ml, onboarded",
      )
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    if (!data)
      return {
        content: [
          { type: "text" as const, text: "No Gymie profile yet — finish onboarding in the app." },
        ],
        isError: true,
      };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: { profile: data },
    };
  },
});
