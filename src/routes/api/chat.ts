import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";

import { supabaseFromRequest } from "@/lib/supabase-request.server";
import { computeTargets, dhakaToday, mealTypeForNow } from "@/lib/nutrition";
import { getAiModel } from "@/lib/ai-gateway.server";

const itemSchema = z.object({
  name: z.string().describe("English food name, e.g. 'Rui fish curry'"),
  name_bn: z.string().nullable().describe("Bangla name if known, else null"),
  quantity_label: z.string().describe("Human portion, e.g. '1 plate (250g)'"),
  grams: z.number().nullable(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  confidence: z.enum(["high", "medium", "estimated"]),
});

function textOf(message: UIMessage) {
  return (message.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await supabaseFromRequest(request);

        if (!auth) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabase, userId } = auth;

        const body = (await request.json()) as {
          messages?: UIMessage[];
        };

        const messages = body.messages;

        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const day = dhakaToday();

        const resolveDay = (input?: string | null) =>
          input && /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : day;

        const weekday = new Date().toLocaleDateString("en-US", {
          timeZone: "Asia/Dhaka",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const [profileRes, todayRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle(),

          supabase
            .from("meal_entries")
            .select(
              "meal_type, food_items(name, calories, protein_g, carbs_g, fat_g)",
            )
            .eq("user_id", userId)
            .eq("logged_on", day),
        ]);

        const profile = profileRes.data;

        const targets = profile?.target_calories
          ? {
              calories: profile.target_calories,
              protein: profile.target_protein_g ?? 0,
              carbs: profile.target_carbs_g ?? 0,
              fat: profile.target_fat_g ?? 0,
              water: profile.target_water_ml ?? 3000,
            }
          : computeTargets({
              age: profile?.age ?? 25,
              gender: profile?.gender ?? "male",
              height_cm: profile?.height_cm ?? 170,
              weight_kg: profile?.weight_kg ?? 60,
              activity_level: profile?.activity_level ?? "light",
              goal: profile?.goal ?? "maintain",
            });

        const eaten = (todayRes.data ?? []).flatMap(
          (entry) =>
            (entry.food_items ?? []) as Array<
              Record<string, number | string>
            >,
        );

        const consumed = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        };

        for (const item of eaten) {
          consumed.calories += Number(item["calories"] ?? 0);
          consumed.protein += Number(item["protein_g"] ?? 0);
          consumed.carbs += Number(item["carbs_g"] ?? 0);
          consumed.fat += Number(item["fat_g"] ?? 0);
        }

        const system = `You are Gymie — a warm, sharp AI nutrition coach built for Bangladesh. You speak natural English and Bangla (including Banglish). Keep replies short, human and encouraging. Use markdown bullets for logged foods.

USER

Name: ${profile?.name ?? "friend"} | Goal: ${profile?.goal ?? "maintain"} | Weight: ${profile?.weight_kg ?? "?"}kg -> goal ${profile?.goal_weight_kg ?? "?"}kg

Daily targets: ${targets.calories} kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat, ${targets.water}ml water.

Already today (${day}): ${Math.round(consumed.calories)} kcal, ${Math.round(consumed.protein)}g protein, ${Math.round(consumed.carbs)}g carbs, ${Math.round(consumed.fat)}g fat.

Current meal slot: ${mealTypeForNow()}.

Today's date (Asia/Dhaka): ${day} (${weekday}).

RULES

1. When the user describes food they ate, call log_meal with every item and full macros. Use search_foods first to ground values in the curated Bangladeshi database when the food might be there.

2. Portions: "1 plate bhat" ≈ 250g cooked rice (~325 kcal), "half plate" ≈ 125g, "1 bowl dal" ≈ 150g, "1 cup" ≈ 240ml, "1 glass" ≈ 250ml, "1 piece chicken curry" ≈ 100g.

3. Never silently assume a big variable (fried vs grilled, beef vs chicken, oil-heavy or not) — ask ONE short clarifying question instead, unless the answer barely changes calories.

4. Mark confidence: "high" when it matches the database, "medium" for standard homemade estimates, "estimated" for guesses. Say when a number is an estimate.

5. After logging, reply with the item list, the meal total, and one line on how it moves them toward today's target.

6. Use log_water / log_weight / log_gym when the user mentions water, weight or gym.

7. Be a coach: if they are far under target and it's late, suggest calorie-dense Bangladeshi options (peanut butter, milk shake, dim khichuri, beef bhuna with rice).

8. DATES MATTER. Every logging tool takes an optional logged_on date (YYYY-MM-DD). If the user mentions a different day — "yesterday", "gotokal", "last Friday", "3 August", "2/8/2026", "kalke raate" — resolve it to a real date relative to today (${day}) and pass it as logged_on. Only omit logged_on (or send null) when the food is for today. Always confirm the date you logged to in your reply, e.g. "Logged to Tue 4 Aug".

9. Never log a future date beyond today; if the user names one, ask them to confirm.

Never invent that you can do things you cannot (photos, barcodes).`;

        const tools = {
          search_foods: tool({
            description:
              "Search the curated Bangladeshi + global food database for per-serving nutrition.",

            inputSchema: z.object({
              query: z.string(),
            }),

            execute: async ({ query }: { query: string }) => {
              const { data } = await supabase
                .from("foods")
                .select(
                  "name_en, name_bn, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg",
                )
                .or(`name_en.ilike.%${query}%,name_bn.ilike.%${query}%`)
                .limit(8);

              return {
                matches: data ?? [],
              };
            },
          }),

          log_meal: tool({
            description:
              "Log foods the user has eaten into their diary, on today's date or any past date.",

            inputSchema: z.object({
              meal_type: z.enum([
                "breakfast",
                "lunch",
                "dinner",
                "snack",
              ]),

              note: z.string().nullable(),

              logged_on: z
                .string()
                .nullable()
                .describe(
                  "Date of the meal as YYYY-MM-DD. Null means today.",
                ),

              items: z.array(itemSchema).min(1),
            }),

            execute: async ({
              meal_type,
              note,
              logged_on,
              items,
            }: {
              meal_type: string;
              note: string | null;
              logged_on: string | null;
              items: Array<z.infer<typeof itemSchema>>;
            }) => {
              const targetDay = resolveDay(logged_on);

              const { data: entry, error } = await supabase
                .from("meal_entries")
                .insert({
                  user_id: userId,
                  meal_type,
                  note,
                  logged_on: targetDay,
                })
                .select("id")
                .single();

              if (error || !entry) {
                return {
                  ok: false,
                  error: error?.message,
                };
              }

              const { error: itemsError } = await supabase
                .from("food_items")
                .insert(
                  items.map((item) => ({
                    entry_id: entry.id,
                    user_id: userId,
                    name: item.name,
                    name_bn: item.name_bn,
                    quantity_label: item.quantity_label,
                    grams: item.grams,
                    calories: Math.round(item.calories),
                    protein_g: item.protein_g,
                    carbs_g: item.carbs_g,
                    fat_g: item.fat_g,
                    fiber_g: item.fiber_g,
                    sugar_g: item.sugar_g,
                    sodium_mg: item.sodium_mg,
                    confidence: item.confidence,
                    is_estimated: item.confidence === "estimated",
                  })),
                );

              if (itemsError) {
                return {
                  ok: false,
                  error: itemsError.message,
                };
              }

              const total = items.reduce(
                (acc, item) => ({
                  calories: acc.calories + item.calories,
                  protein: acc.protein + item.protein_g,
                  carbs: acc.carbs + item.carbs_g,
                  fat: acc.fat + item.fat_g,
                }),
                {
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                },
              );

              consumed.calories += total.calories;
              consumed.protein += total.protein;

              return {
                ok: true,
                logged_on: targetDay,
                logged: items.length,
                total,
                remaining_calories: Math.round(
                  targets.calories - consumed.calories,
                ),
                remaining_protein: Math.round(
                  targets.protein - consumed.protein,
                ),
              };
            },
          }),

          log_water: tool({
            description:
              "Log water intake in millilitres for today or a past date.",

            inputSchema: z.object({
              amount_ml: z.number(),
              logged_on: z.string().nullable(),
            }),

            execute: async ({
              amount_ml,
              logged_on,
            }: {
              amount_ml: number;
              logged_on: string | null;
            }) => {
              const targetDay = resolveDay(logged_on);

              await supabase.from("water_logs").insert({
                user_id: userId,
                amount_ml: Math.round(amount_ml),
                logged_on: targetDay,
              });

              return {
                ok: true,
                logged_on: targetDay,
              };
            },
          }),

          log_weight: tool({
            description:
              "Log body weight in kilograms for today or a past date.",

            inputSchema: z.object({
              weight_kg: z.number(),
              logged_on: z.string().nullable(),
            }),

            execute: async ({
              weight_kg,
              logged_on,
            }: {
              weight_kg: number;
              logged_on: string | null;
            }) => {
              const targetDay = resolveDay(logged_on);

              await supabase
                .from("weight_logs")
                .upsert(
                  {
                    user_id: userId,
                    weight_kg,
                    logged_on: targetDay,
                  },
                  {
                    onConflict: "user_id,logged_on",
                  },
                );

              if (targetDay === day) {
                await supabase
                  .from("profiles")
                  .update({ weight_kg })
                  .eq("id", userId);
              }

              return {
                ok: true,
                logged_on: targetDay,
              };
            },
          }),

          log_gym: tool({
            description:
              "Mark whether the user trained on a given date (defaults to today).",

            inputSchema: z.object({
              attended: z.boolean(),
              logged_on: z.string().nullable(),
            }),

            execute: async ({
              attended,
              logged_on,
            }: {
              attended: boolean;
              logged_on: string | null;
            }) => {
              const targetDay = resolveDay(logged_on);

              await supabase
                .from("gym_logs")
                .upsert(
                  {
                    user_id: userId,
                    attended,
                    logged_on: targetDay,
                  },
                  {
                    onConflict: "user_id,logged_on",
                  },
                );

              return {
                ok: true,
                logged_on: targetDay,
              };
            },
          }),
        };

        const result = streamText({
          model: getAiModel("gemini-3.6-flash"),
          system,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(12),
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,

          headers: {},

          onFinish: async ({ messages: finalMessages }) => {
            const tail = finalMessages.slice(-2);

            const rows = tail
              .map((message) => ({
                user_id: userId,
                role: message.role,
                content: textOf(message),
              }))
              .filter((row) => row.content.length > 0);

            if (rows.length === 0) return;

            const { error } = await supabase
              .from("chat_messages")
              .insert(rows);

            if (error) {
              console.error(
                "[gymie] failed to save chat",
                error.message,
              );
            }
          },
        });

        return response;
      },
    },
  },
});