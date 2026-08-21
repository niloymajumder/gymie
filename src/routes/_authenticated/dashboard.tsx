import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  deleteFoodItem,
  getDay,
  getFrequentMeals,
  getHistory,
  getLoggedDays,
  getProfile,
  logGym,
  logWater,
  logWeight,
  quickLogMeal,
} from "@/lib/gymie.functions";
import { dhakaToday, mealTypeForNow } from "@/lib/nutrition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Food Diary — Gymie" },
      {
        name: "description",
        content: "Your day-by-day food diary: calories, macros, water, weight and gym in one place.",
      },
      { property: "og:title", content: "Food Diary on Gymie" },
      {
        property: "og:description",
        content: "Browse any date and see calories, macros, water, weight and meals logged.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Diary,
});

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function toDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function toDayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function prettyDay(day: string, today: string) {
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  return toDate(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function MacroBar({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const left = Math.max(0, Math.round(target - value));
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{left} {unit} left</p>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {Math.round(value)}
        <span className="text-xs font-normal text-muted-foreground">
          {" "}/ {Math.round(target)} {unit}
        </span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function CalorieRing({ value, target }: { value: number; target: number }) {
  const pct = target ? Math.min(1, value / target) : 0;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="glass-strong flex items-center gap-5 rounded-3xl p-5">
      <div className="relative size-[150px] shrink-0">
        <svg viewBox="0 0 150 150" className="size-full -rotate-90">
          <circle cx="75" cy="75" r={radius} fill="none" strokeWidth="12" className="stroke-muted" />
          <motion.circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            stroke="var(--primary)"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{Math.round(value)}</p>
            <p className="text-[11px] text-muted-foreground">of {Math.round(target)} kcal</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">
          {value > target
            ? `${Math.round(value - target)} kcal over target`
            : `${Math.round(target - value)} kcal remaining`}
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.round(pct * 100)}% of your daily energy goal logged.
        </p>
      </div>
    </div>
  );
}

function Diary() {
  const queryClient = useQueryClient();
  const today = dhakaToday();
  const [day, setDay] = useState(today);
  const [weightInput, setWeightInput] = useState("");
  const [customWater, setCustomWater] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchDay = useServerFn(getDay);
  const fetchProfile = useServerFn(getProfile);
  const fetchHistory = useServerFn(getHistory);
  const fetchFrequent = useServerFn(getFrequentMeals);
  const fetchLoggedDays = useServerFn(getLoggedDays);
  const water = useServerFn(logWater);
  const gym = useServerFn(logGym);
  const weight = useServerFn(logWeight);
  const quickAdd = useServerFn(quickLogMeal);
  const removeItem = useServerFn(deleteFoodItem);

  const { data: dayData, isLoading } = useQuery({
    queryKey: ["day", day],
    queryFn: () => fetchDay({ data: { day } }),
  });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });
  const { data: history } = useQuery({ queryKey: ["history"], queryFn: () => fetchHistory({}) });
  const { data: frequent } = useQuery({ queryKey: ["frequent"], queryFn: () => fetchFrequent({}) });
  const { data: loggedDays } = useQuery({
    queryKey: ["logged-days"],
    queryFn: () => fetchLoggedDays({}),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["day"] });
    void queryClient.invalidateQueries({ queryKey: ["history"] });
    void queryClient.invalidateQueries({ queryKey: ["logged-days"] });
  };

  const addWater = useMutation({
    mutationFn: (amount_ml: number) => water({ data: { amount_ml, day } }),
    onSuccess: invalidate,
  });
  const toggleGym = useMutation({
    mutationFn: (attended: boolean) => gym({ data: { attended, day } }),
    onSuccess: invalidate,
  });
  const saveWeight = useMutation({
    mutationFn: (weight_kg: number) => weight({ data: { weight_kg, day } }),
    onSuccess: () => {
      setWeightInput("");
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  const quick = useMutation({
    mutationFn: (meal: { name: string; quantity_label: string; calories: number; protein: number }) =>
      quickAdd({
        data: {
          day,
          meal_type: mealTypeForNow(),
          name: meal.name,
          quantity_label: meal.quantity_label,
          calories: meal.calories,
          protein_g: meal.protein,
        },
      }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["frequent"] });
    },
  });
  const drop = useMutation({
    mutationFn: (id: string) => removeItem({ data: { id } }),
    onSuccess: invalidate,
  });

  const totals = dayData?.totals ?? {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };

  const streak = useMemo(() => {
    const days = [...(history?.days ?? [])].reverse();
    let count = 0;
    for (const d of days) {
      if (d.calories > 0) count += 1;
      else break;
    }
    return count;
  }, [history]);

  const grouped = useMemo(() => {
    const entries = dayData?.entries ?? [];
    return MEAL_ORDER.map((type) => {
      const rows = entries.filter((entry) => entry.meal_type === type);
      const items = rows.flatMap((entry) => entry.items);
      const kcal = items.reduce((sum, item) => sum + Number(item.calories ?? 0), 0);
      return { type, items, kcal };
    }).filter((group) => group.items.length > 0);
  }, [dayData]);

  const loggedSet = useMemo(() => new Set(loggedDays ?? []), [loggedDays]);
  const isFuture = day >= today;

  return (
    <AppShell>
      <div className="space-y-4 py-4 sm:py-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">Food Diary</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.name ? `${profile.name} · ` : ""}
              {toDate(day).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap">
            <Flame className="size-3.5 text-primary" /> {streak} day streak
          </div>
        </div>

        <div className="glass flex items-center justify-between gap-1 rounded-2xl p-1.5 sm:gap-2 sm:p-2">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label="Previous day"
            onClick={() => setDay(shiftDay(day, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="min-w-0 rounded-full px-2 text-sm font-medium sm:px-4">
                  <CalendarDays className="mr-1.5 size-4 shrink-0 sm:mr-2" />
                  {prettyDay(day, today)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="center">
                <Calendar
                  mode="single"
                  selected={toDate(day)}
                  onSelect={(date) => {
                    if (!date) return;
                    setDay(toDayString(date));
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => toDayString(date) > today}
                  modifiers={{ logged: (date) => loggedSet.has(toDayString(date)) }}
                  modifiersClassNames={{ logged: "font-semibold text-primary underline" }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {day !== today && (
              <Button size="sm" variant="outline" className="shrink-0 rounded-full px-2.5 text-xs sm:px-3 sm:text-sm" onClick={() => setDay(today)}>
                <span className="sm:hidden">Today</span>
                <span className="hidden sm:inline">Jump to today</span>
              </Button>
            )}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label="Next day"
            disabled={isFuture}
            onClick={() => setDay(shiftDay(day, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <CalorieRing value={totals.calories} target={profile?.target_calories ?? 2500} />

        <div className="grid gap-3 sm:grid-cols-3">
          <MacroBar
            label="Protein"
            value={totals.protein}
            target={profile?.target_protein_g ?? 120}
            unit="g"
            color="var(--protein)"
          />
          <MacroBar
            label="Carbs"
            value={totals.carbs}
            target={profile?.target_carbs_g ?? 300}
            unit="g"
            color="var(--carbs)"
          />
          <MacroBar
            label="Fat"
            value={totals.fat}
            target={profile?.target_fat_g ?? 70}
            unit="g"
            color="var(--fat)"
          />
        </div>

        <div className="glass grid grid-cols-3 gap-2 rounded-2xl p-4 text-center">
          {[
            { label: "Fiber", value: `${Math.round(totals.fiber ?? 0)} g` },
            { label: "Sugar", value: `${Math.round(totals.sugar ?? 0)} g` },
            { label: "Sodium", value: `${Math.round(totals.sodium ?? 0)} mg` },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Droplets className="size-4 text-[var(--water)]" /> Water
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {((dayData?.water ?? 0) / 1000).toFixed(1)} /{" "}
                {((profile?.target_water_ml ?? 3000) / 1000).toFixed(1)} L
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[250, 500, 1000].map((amount) => (
                <Button
                  key={amount}
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => addWater.mutate(amount)}
                >
                  +{amount}ml
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                disabled={(dayData?.water ?? 0) <= 0}
                onClick={() => addWater.mutate(-250)}
              >
                −250ml
              </Button>
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const amount = Number(customWater);
                if (!amount) return;
                addWater.mutate(amount);
                setCustomWater("");
              }}
            >
              <Input
                type="number"
                inputMode="numeric"
                value={customWater}
                onChange={(event) => setCustomWater(event.target.value)}
                placeholder="Custom ml"
                className="h-8 rounded-full text-sm"
                aria-label="Custom water amount in millilitres"
              />
              <Button type="submit" size="sm" variant="outline" className="rounded-full">
                <Plus className="size-3.5" />
              </Button>
            </form>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Dumbbell className="size-4 text-primary" /> Training
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant={dayData?.gym === true ? "default" : "outline"}
                className="rounded-full"
                onClick={() => toggleGym.mutate(true)}
              >
                Trained
              </Button>
              <Button
                size="sm"
                variant={dayData?.gym === false ? "default" : "outline"}
                className="rounded-full"
                onClick={() => toggleGym.mutate(false)}
              >
                Rest day
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {dayData?.gym === true
                ? "Nice work — recovery meal and protein matter most now."
                : dayData?.gym === false
                  ? "Rest day logged. Keep protein steady."
                  : "Not logged yet for this day."}
            </p>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Scale className="size-4 text-primary" /> Weight
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {dayData?.weight != null ? `${dayData.weight} kg` : "—"}
            </p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = Number(weightInput);
                if (!value) return;
                saveWeight.mutate(value);
              }}
            >
              <Input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={weightInput}
                onChange={(event) => setWeightInput(event.target.value)}
                placeholder="kg"
                className="h-8 rounded-full text-sm"
                aria-label="Weight in kilograms"
              />
              <Button type="submit" size="sm" variant="outline" className="rounded-full">
                Save
              </Button>
            </form>
          </div>
        </div>

        {(frequent ?? []).length > 0 && (
          <div className="glass rounded-2xl p-4">
            <p className="text-sm font-medium">Your usuals — one tap to log</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(frequent ?? []).map((meal) => (
                <button
                  key={`${meal.name}-${meal.quantity_label}`}
                  type="button"
                  disabled={quick.isPending}
                  onClick={() =>
                    quick.mutate({
                      name: meal.name,
                      quantity_label: meal.quantity_label,
                      calories: meal.calories,
                      protein: meal.protein,
                    })
                  }
                  className="glass-strong rounded-full px-3 py-1.5 text-left text-xs transition-colors hover:text-primary"
                >
                  <span className="font-medium">{meal.name}</span>
                  <span className="text-muted-foreground">
                    {" "}· {meal.quantity_label} · {Math.round(meal.calories)} kcal
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Meals · {prettyDay(day, today)}</h2>
            <p className="text-xs text-muted-foreground">
              {(dayData?.entries ?? []).reduce((sum, entry) => sum + entry.items.length, 0)} items
            </p>
          </div>

          {isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading your day…</p>}

          {!isLoading && grouped.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing logged for this date — tell Gymie in chat what you ate
              {day === today ? " today" : ` on ${prettyDay(day, today)}`}.
            </p>
          )}

          <div className="mt-3 space-y-5">
            {grouped.map((group) => (
              <div key={group.type}>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.type}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(group.kcal)} kcal
                  </p>
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {item.name}
                        <span className="text-muted-foreground"> · {item.quantity_label}</span>
                        {item.is_estimated && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            estimated
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {Math.round(item.calories)} kcal · {Math.round(item.protein_g)}g P
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => drop.mutate(item.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
