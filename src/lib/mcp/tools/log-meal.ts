import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { dhakaToday } from "@/lib/nutrition";

export default defineTool({
  name: "log_meal",
  title: "Log a meal",
  description:
    "Log a meal with one or more foods (name, portion and macros) into the signed-in user's Gymie diary for a given day.",
  inputSchema: {
    meal_type: z
      .enum(["breakfast", "lunch", "dinner", "snack"])
      .describe("Which meal this belongs to."),
    date: z
      .string()
      .optional()
      .describe("Day in YYYY-MM-DD (Asia/Dhaka). Defaults to today."),
    note: z.string().optional().describe("Optional note about the meal."),
    items: z
      .array(
        z.object({
          name: z.string().describe("Food name, English or Bangla."),
          quantity_label: z.string().describe("Portion, e.g. '1 plate', '2 pieces', '250 g'."),
          calories: z.number().describe("Calories in kcal for this portion."),
          protein_g: z.number().describe("Protein in grams."),
          carbs_g: z.number().optional(),
          fat_g: z.number().optional(),
          fiber_g: z.number().optional(),
          sugar_g: z.number().optional(),
          sodium_mg: z.number().optional(),
          confidence: z
            .enum(["high", "medium", "estimated"])
            .optional()
            .describe("How confident the macro values are. Defaults to medium."),
        }),
      )
      .describe("Foods eaten in this meal."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ meal_type, date, note, items }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    if (items.length === 0) throw new ToolError("Provide at least one food item.");

    const day = date ?? dhakaToday();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: entry, error } = await supabase
      .from("meal_entries")
      .insert({ user_id: userId, meal_type, note: note ?? null, logged_on: day })
      .select("id")
      .single();
    if (error || !entry)
      return {
        content: [{ type: "text" as const, text: error?.message ?? "Could not create meal entry" }],
        isError: true,
      };

    const { error: itemsError } = await supabase.from("food_items").insert(
      items.map((item) => ({
        entry_id: entry.id,
        user_id: userId,
        name: item.name,
        quantity_label: item.quantity_label,
        calories: Math.round(item.calories),
        protein_g: item.protein_g,
        carbs_g: item.carbs_g ?? 0,
        fat_g: item.fat_g ?? 0,
        fiber_g: item.fiber_g ?? null,
        sugar_g: item.sugar_g ?? null,
        sodium_mg: item.sodium_mg ?? null,
        confidence: item.confidence ?? "medium",
        is_estimated: (item.confidence ?? "medium") === "estimated",
      })),
    );
    if (itemsError)
      return { content: [{ type: "text" as const, text: itemsError.message }], isError: true };

    const totals = items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein_g: acc.protein_g + item.protein_g,
      }),
      { calories: 0, protein_g: 0 },
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `Logged ${items.length} item(s) to ${meal_type} on ${day}: ${Math.round(totals.calories)} kcal, ${Math.round(totals.protein_g)} g protein.`,
        },
      ],
      structuredContent: { entry_id: entry.id, date: day, meal_type, totals },
    };
  },
});
