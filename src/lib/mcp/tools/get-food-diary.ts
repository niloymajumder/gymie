import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { dhakaToday } from "@/lib/nutrition";

type Item = {
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export default defineTool({
  name: "get_food_diary",
  title: "Get food diary for a day",
  description:
    "Read the signed-in user's Gymie food diary for one day: every logged meal with its foods and macros, plus daily totals, water, weight and gym status.",
  inputSchema: {
    date: z
      .string()
      .optional()
      .describe("Day to read in YYYY-MM-DD (Asia/Dhaka). Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    const day = date ?? dhakaToday();
    const supabase = supabaseForUser(ctx);

    const [entriesRes, waterRes, weightRes, gymRes] = await Promise.all([
      supabase
        .from("meal_entries")
        .select("id, meal_type, note, logged_at, food_items(name, quantity_label, calories, protein_g, carbs_g, fat_g, confidence, is_estimated)")
        .eq("logged_on", day)
        .order("logged_at", { ascending: true }),
      supabase.from("water_logs").select("amount_ml").eq("logged_on", day),
      supabase.from("weight_logs").select("weight_kg").eq("logged_on", day).maybeSingle(),
      supabase.from("gym_logs").select("attended").eq("logged_on", day).maybeSingle(),
    ]);

    if (entriesRes.error)
      return { content: [{ type: "text" as const, text: entriesRes.error.message }], isError: true };

    const entries = entriesRes.data ?? [];
    const totals = entries
      .flatMap((entry) => ((entry as { food_items?: Item[] }).food_items ?? []))
      .reduce(
        (acc, item) => ({
          calories: acc.calories + Number(item.calories ?? 0),
          protein_g: acc.protein_g + Number(item.protein_g ?? 0),
          carbs_g: acc.carbs_g + Number(item.carbs_g ?? 0),
          fat_g: acc.fat_g + Number(item.fat_g ?? 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      );

    const result = {
      date: day,
      entries,
      totals,
      water_ml: (waterRes.data ?? []).reduce((sum, r) => sum + Number(r.amount_ml ?? 0), 0),
      weight_kg: weightRes.data?.weight_kg ?? null,
      gym_attended: gymRes.data?.attended ?? null,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
