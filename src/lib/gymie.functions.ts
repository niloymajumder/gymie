import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withSkewRetry } from "@/lib/supabase-query.server";
import { calcBmi, computeTargets, dhakaToday, type Biometrics } from "@/lib/nutrition";

export type FoodItemRow = {
  id: string;
  entry_id: string;
  name: string;
  name_bn: string | null;
  quantity_label: string;
  grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  confidence: string;
  is_estimated: boolean;
};

export type MealEntryRow = {
  id: string;
  meal_type: string;
  note: string | null;
  logged_at: string;
  items: FoodItemRow[];
};

function dayRange(day: string) {
  return day;
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await withSkewRetry(() =>
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
    );
    if (error) throw new Error(error.message);
    if (!data) {
      const { data: created, error: insertError } = await context.supabase
        .from("profiles")
        .insert({ id: context.userId })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      return created;
    }
    return data;
  });

export type ProfileInput = {
  name: string;
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg: number;
  activity_level: string;
  gym_days_per_week: number;
  daily_steps: number;
  goal: string;
};

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProfileInput) => input)
  .handler(async ({ data, context }) => {
    const targets = computeTargets(data as Biometrics);
    const { error } = await context.supabase
      .from("profiles")
      .update({
        ...data,
        target_calories: targets.calories,
        target_protein_g: targets.protein,
        target_carbs_g: targets.carbs,
        target_fat_g: targets.fat,
        target_water_ml: targets.water,
        onboarded: true,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    await context.supabase
      .from("weight_logs")
      .upsert(
        { user_id: context.userId, weight_kg: data.weight_kg, logged_on: dhakaToday() },
        { onConflict: "user_id,logged_on" },
      );
    return { ok: true, targets };
  });

export const getDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { day?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const day = dayRange(data.day ?? dhakaToday());
    const [entriesRes, waterRes, gymRes, weightRes] = await Promise.all([
      withSkewRetry(() =>
        context.supabase
          .from("meal_entries")
          .select("id, meal_type, note, logged_at, food_items(*)")
          .eq("user_id", context.userId)
          .eq("logged_on", day)
          .order("logged_at", { ascending: true }),
      ),
      context.supabase
        .from("water_logs")
        .select("amount_ml")
        .eq("user_id", context.userId)
        .eq("logged_on", day),
      context.supabase
        .from("gym_logs")
        .select("attended")
        .eq("user_id", context.userId)
        .eq("logged_on", day)
        .maybeSingle(),
      context.supabase
        .from("weight_logs")
        .select("weight_kg")
        .eq("user_id", context.userId)
        .eq("logged_on", day)
        .maybeSingle(),
    ]);

    if (entriesRes.error) throw new Error(entriesRes.error.message);

    const entries: MealEntryRow[] = (entriesRes.data ?? []).map((row) => {
      const { food_items, ...rest } = row as typeof row & { food_items: FoodItemRow[] };
      return { ...rest, items: food_items ?? [] } as MealEntryRow;
    });

    const totals = entries
      .flatMap((entry) => entry.items)
      .reduce(
        (acc, item) => ({
          calories: acc.calories + Number(item.calories ?? 0),
          protein: acc.protein + Number(item.protein_g ?? 0),
          carbs: acc.carbs + Number(item.carbs_g ?? 0),
          fat: acc.fat + Number(item.fat_g ?? 0),
          fiber: acc.fiber + Number(item.fiber_g ?? 0),
          sugar: acc.sugar + Number(item.sugar_g ?? 0),
          sodium: acc.sodium + Number(item.sodium_mg ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
      );

    const water = (waterRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.amount_ml ?? 0),
      0,
    );

    return {
      day,
      entries,
      totals,
      water,
      gym: gymRes.data?.attended ?? null,
      weight: weightRes.data?.weight_kg != null ? Number(weightRes.data.weight_kg) : null,
    };
  });

export const getHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Dhaka",
    });

    const [weights, entries, water, gym] = await Promise.all([
      context.supabase
        .from("weight_logs")
        .select("weight_kg, logged_on")
        .eq("user_id", context.userId)
        .gte("logged_on", since)
        .order("logged_on"),
      context.supabase
        .from("meal_entries")
        .select("logged_on, food_items(calories, protein_g, carbs_g, fat_g)")
        .eq("user_id", context.userId)
        .gte("logged_on", since),
      context.supabase
        .from("water_logs")
        .select("logged_on, amount_ml")
        .eq("user_id", context.userId)
        .gte("logged_on", since),
      context.supabase
        .from("gym_logs")
        .select("logged_on, attended")
        .eq("user_id", context.userId)
        .gte("logged_on", since),
    ]);

    const byDay = new Map<
      string,
      { day: string; calories: number; protein: number; carbs: number; fat: number; water: number; gym: boolean }
    >();
    const ensure = (day: string) => {
      let row = byDay.get(day);
      if (!row) {
        row = { day, calories: 0, protein: 0, carbs: 0, fat: 0, water: 0, gym: false };
        byDay.set(day, row);
      }
      return row;
    };

    for (const entry of entries.data ?? []) {
      const row = ensure(entry.logged_on as string);
      for (const item of (entry.food_items ?? []) as Array<Record<string, number>>) {
        row.calories += Number(item['calories'] ?? 0);
        row.protein += Number(item['protein_g'] ?? 0);
        row.carbs += Number(item['carbs_g'] ?? 0);
        row.fat += Number(item['fat_g'] ?? 0);
      }
    }
    for (const w of water.data ?? []) {
      ensure(w.logged_on as string).water += Number(w.amount_ml ?? 0);
    }
    for (const g of gym.data ?? []) {
      ensure(g.logged_on as string).gym = Boolean(g.attended);
    }

    return {
      days: Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)),
      weights: (weights.data ?? []).map((w) => ({
        day: w.logged_on as string,
        weight: Number(w.weight_kg),
      })),
    };
  });

export const logWater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount_ml: number; day?: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("water_logs").insert({
      user_id: context.userId,
      amount_ml: Math.max(-2000, Math.min(2000, Math.round(data.amount_ml))),
      logged_on: data.day ?? dhakaToday(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weight_kg: number; day?: string }) => input)
  .handler(async ({ data, context }) => {
    const today = dhakaToday();
    const day = data.day ?? today;
    const { error } = await context.supabase
      .from("weight_logs")
      .upsert(
        { user_id: context.userId, weight_kg: data.weight_kg, logged_on: day },
        { onConflict: "user_id,logged_on" },
      );
    if (error) throw new Error(error.message);
    if (day === today) {
      await context.supabase
        .from("profiles")
        .update({ weight_kg: data.weight_kg })
        .eq("id", context.userId);
    }
    return { ok: true };
  });

export const logGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attended: boolean; day?: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("gym_logs")
      .upsert(
        { user_id: context.userId, attended: data.attended, logged_on: data.day ?? dhakaToday() },
        { onConflict: "user_id,logged_on" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const quickLogMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      day?: string;
      meal_type: string;
      name: string;
      quantity_label: string;
      calories: number;
      protein_g: number;
      carbs_g?: number;
      fat_g?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const day = data.day ?? dhakaToday();
    const { data: entry, error } = await context.supabase
      .from("meal_entries")
      .insert({
        user_id: context.userId,
        meal_type: data.meal_type,
        note: "Quick add",
        logged_on: day,
      })
      .select("id")
      .single();
    if (error || !entry) throw new Error(error?.message ?? "Could not create entry");

    const { error: itemError } = await context.supabase.from("food_items").insert({
      entry_id: entry.id,
      user_id: context.userId,
      name: data.name,
      quantity_label: data.quantity_label,
      calories: Math.round(data.calories),
      protein_g: data.protein_g,
      carbs_g: data.carbs_g ?? 0,
      fat_g: data.fat_g ?? 0,
      confidence: "medium",
    });
    if (itemError) throw new Error(itemError.message);
    return { ok: true };
  });

export const getLoggedDays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 179 * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Dhaka",
    });
    const { data, error } = await context.supabase
      .from("meal_entries")
      .select("logged_on")
      .eq("user_id", context.userId)
      .gte("logged_on", since);
    if (error) throw new Error(error.message);
    return Array.from(new Set((data ?? []).map((row) => row.logged_on as string)));
  });

export const deleteFoodItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("food_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await withSkewRetry(() =>
      context.supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(200),
    );
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const clearChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const getFrequentMeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("food_items")
      .select("name, quantity_label, calories, protein_g")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const counts = new Map<
      string,
      { name: string; quantity_label: string; calories: number; protein: number; count: number }
    >();
    for (const item of data ?? []) {
      const key = `${item.name}|${item.quantity_label}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else
        counts.set(key, {
          name: item.name as string,
          quantity_label: item.quantity_label as string,
          calories: Number(item.calories),
          protein: Number(item.protein_g),
          count: 1,
        });
    }
    return Array.from(counts.values())
      .filter((row) => row.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  });

export const getChatDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await withSkewRetry(() =>
      context.supabase
        .from("chat_drafts")
        .select("content, updated_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    );
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const saveChatDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { content: string }) => input)
  .handler(async ({ data, context }) => {
    const content = (data.content ?? "").slice(0, 4000);
    const { error } = await context.supabase
      .from("chat_drafts")
      .upsert(
        { user_id: context.userId, content, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, savedAt: new Date().toISOString() };
  });

export const getBlueprintInsight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blueprint_insights")
      .select("content, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const generateBlueprintInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 13 * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Dhaka",
    });

    const [profileRes, itemsRes, gymRes, weightRes] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("meal_entries")
        .select("logged_on, food_items(calories, protein_g)")
        .eq("user_id", context.userId)
        .gte("logged_on", since),
      context.supabase
        .from("gym_logs")
        .select("logged_on, attended")
        .eq("user_id", context.userId)
        .gte("logged_on", since),
      context.supabase
        .from("weight_logs")
        .select("weight_kg, logged_on")
        .eq("user_id", context.userId)
        .gte("logged_on", since)
        .order("logged_on"),
    ]);

    const profile = profileRes.data;
    const perDay = new Map<string, { calories: number; protein: number }>();
    for (const entry of itemsRes.data ?? []) {
      const day = entry.logged_on as string;
      const row = perDay.get(day) ?? { calories: 0, protein: 0 };
      for (const item of (entry.food_items ?? []) as Array<Record<string, number>>) {
        row.calories += Number(item['calories'] ?? 0);
        row.protein += Number(item['protein_g'] ?? 0);
      }
      perDay.set(day, row);
    }
    const days = Array.from(perDay.values());
    const avg = (pick: (r: { calories: number; protein: number }) => number) =>
      days.length ? Math.round(days.reduce((s, r) => s + pick(r), 0) / days.length) : null;

    const weights = weightRes.data ?? [];
    const first = weights[0]?.weight_kg;
    const last = weights[weights.length - 1]?.weight_kg;

    const bmi = calcBmi(Number(profile?.weight_kg) || 60, Number(profile?.height_cm) || 170);

    const { generateBlueprintText } = await import("@/lib/blueprint.server");
    const content = await generateBlueprintText({
      name: profile?.name || "there",
      goal: profile?.goal ?? "lean_bulk",
      frame: bmi < 18.5 ? "very lean / underweight" : bmi < 22 ? "slim" : "balanced",
      bmi,
      weight: profile?.weight_kg != null ? Number(profile.weight_kg) : null,
      goalWeight: profile?.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null,
      gymDays: Number(profile?.gym_days_per_week ?? 0),
      targetCalories: profile?.target_calories ?? null,
      targetProtein: profile?.target_protein_g ?? null,
      avgCalories: avg((r) => r.calories),
      avgProtein: avg((r) => r.protein),
      daysLogged: days.length,
      trainedDays: (gymRes.data ?? []).filter((g) => g.attended).length,
      weightChangeKg:
        first != null && last != null ? Math.round((Number(last) - Number(first)) * 10) / 10 : null,
    });

    const { error } = await context.supabase
      .from("blueprint_insights")
      .upsert(
        { user_id: context.userId, content, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { content, updated_at: new Date().toISOString() };
  });
