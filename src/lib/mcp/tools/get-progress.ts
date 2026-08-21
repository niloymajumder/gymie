import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_progress",
  title: "Get progress trend",
  description:
    "Get the signed-in user's recent Gymie trend: daily calories and protein, water, gym days, and bodyweight logs over the last N days.",
  inputSchema: {
    days: z.number().optional().describe("How many days back to include. Defaults to 30."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    const window = Math.max(1, Math.min(180, Math.round(days ?? 30)));
    const since = new Date(Date.now() - (window - 1) * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Dhaka",
    });
    const supabase = supabaseForUser(ctx);

    const [entries, water, gym, weights] = await Promise.all([
      supabase
        .from("meal_entries")
        .select("logged_on, food_items(calories, protein_g, carbs_g, fat_g)")
        .gte("logged_on", since),
      supabase.from("water_logs").select("logged_on, amount_ml").gte("logged_on", since),
      supabase.from("gym_logs").select("logged_on, attended").gte("logged_on", since),
      supabase
        .from("weight_logs")
        .select("logged_on, weight_kg")
        .gte("logged_on", since)
        .order("logged_on"),
    ]);

    const byDay = new Map<
      string,
      { date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number; gym: boolean }
    >();
    const ensure = (date: string) => {
      let row = byDay.get(date);
      if (!row) {
        row = { date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0, gym: false };
        byDay.set(date, row);
      }
      return row;
    };

    for (const entry of entries.data ?? []) {
      const row = ensure(entry.logged_on as string);
      for (const item of ((entry as { food_items?: Array<Record<string, number>> }).food_items ?? [])) {
        row.calories += Number(item['calories'] ?? 0);
        row.protein_g += Number(item['protein_g'] ?? 0);
        row.carbs_g += Number(item['carbs_g'] ?? 0);
        row.fat_g += Number(item['fat_g'] ?? 0);
      }
    }
    for (const w of water.data ?? []) ensure(w.logged_on as string).water_ml += Number(w.amount_ml ?? 0);
    for (const g of gym.data ?? []) ensure(g.logged_on as string).gym = Boolean(g.attended);

    const result = {
      since,
      days: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      weights: (weights.data ?? []).map((w) => ({
        date: w.logged_on as string,
        weight_kg: Number(w.weight_kg),
      })),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
