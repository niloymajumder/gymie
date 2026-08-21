import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { dhakaToday } from "@/lib/nutrition";

export default defineTool({
  name: "log_daily_stat",
  title: "Log water, weight or gym",
  description:
    "Log the signed-in user's water intake, bodyweight, or gym attendance for a day in Gymie.",
  inputSchema: {
    water_ml: z.number().optional().describe("Water to add in millilitres (can be negative to undo)."),
    weight_kg: z.number().optional().describe("Bodyweight in kilograms for this day."),
    gym_attended: z.boolean().optional().describe("Whether the user trained on this day."),
    date: z.string().optional().describe("Day in YYYY-MM-DD (Asia/Dhaka). Defaults to today."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ water_ml, weight_kg, gym_attended, date }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    if (water_ml == null && weight_kg == null && gym_attended == null)
      return {
        content: [
          { type: "text" as const, text: "Provide at least one of water_ml, weight_kg or gym_attended." },
        ],
        isError: true,
      };

    const day = date ?? dhakaToday();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const done: string[] = [];

    if (water_ml != null) {
      const amount = Math.max(-2000, Math.min(2000, Math.round(water_ml)));
      const { error } = await supabase
        .from("water_logs")
        .insert({ user_id: userId, amount_ml: amount, logged_on: day });
      if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
      done.push(`${amount} ml water`);
    }

    if (weight_kg != null) {
      const { error } = await supabase
        .from("weight_logs")
        .upsert({ user_id: userId, weight_kg, logged_on: day }, { onConflict: "user_id,logged_on" });
      if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
      if (day === dhakaToday()) {
        await supabase.from("profiles").update({ weight_kg }).eq("id", userId);
      }
      done.push(`weight ${weight_kg} kg`);
    }

    if (gym_attended != null) {
      const { error } = await supabase
        .from("gym_logs")
        .upsert(
          { user_id: userId, attended: gym_attended, logged_on: day },
          { onConflict: "user_id,logged_on" },
        );
      if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
      done.push(gym_attended ? "gym attended" : "rest day");
    }

    return {
      content: [{ type: "text" as const, text: `Logged for ${day}: ${done.join(", ")}.` }],
      structuredContent: { date: day, logged: done },
    };
  },
});
