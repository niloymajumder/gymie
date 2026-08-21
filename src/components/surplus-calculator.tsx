import { useMemo, useState } from "react";
import { computeTargets, type Biometrics } from "@/lib/nutrition";

type Profile = {
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: string | null;
  goal?: string | null;
  gym_days_per_week?: number | null;
  daily_steps?: number | null;
} | null;

const RATES = [
  { label: "Slow", pct: 0.25, blurb: "Leanest gain" },
  { label: "Steady", pct: 0.375, blurb: "Recommended" },
  { label: "Fast", pct: 0.5, blurb: "More fat risk" },
];

const KCAL_PER_KG = 7700;

export function SurplusCalculator({
  profile,
  last7Calories,
}: {
  profile: Profile;
  last7Calories: number[];
}) {
  const [ratePct, setRatePct] = useState(0.375);

  const weight = Number(profile?.weight_kg) || 60;
  const tdee = useMemo(
    () =>
      computeTargets({
        age: Number(profile?.age) || 25,
        gender: profile?.gender ?? "male",
        height_cm: Number(profile?.height_cm) || 170,
        weight_kg: weight,
        activity_level: profile?.activity_level ?? "light",
        goal: "maintain",
        gym_days_per_week: profile?.gym_days_per_week ?? 0,
        daily_steps: profile?.daily_steps ?? 5000,
      } as Biometrics).tdee,
    [profile, weight],
  );

  const kgPerWeek = Math.round(((weight * ratePct) / 100) * 100) / 100;
  const dailySurplus = Math.round((kgPerWeek * KCAL_PER_KG) / 7);
  const targetCalories = tdee + dailySurplus;

  const logged = last7Calories.filter((c) => c > 0);
  const avgIntake = logged.length
    ? Math.round(logged.reduce((s, c) => s + c, 0) / logged.length)
    : 0;
  const actualSurplus = avgIntake ? avgIntake - tdee : 0;
  const weeklyBank = actualSurplus * 7;
  const projectedKg = Math.round((weeklyBank / KCAL_PER_KG) * 100) / 100;
  const gap = avgIntake ? targetCalories - avgIntake : 0;

  return (
    <div className="glass-strong rounded-3xl p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Calorie surplus calculator</h2>
        <p className="text-xs text-muted-foreground">Maintenance ≈ {tdee} kcal</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {RATES.map((rate) => {
          const active = rate.pct === ratePct;
          return (
            <button
              key={rate.label}
              type="button"
              onClick={() => setRatePct(rate.pct)}
              className={`rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <p className="text-sm font-medium">{rate.label}</p>
              <p className="text-xs text-muted-foreground">
                {rate.pct}% BW / wk
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{rate.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Target intake", `${targetCalories}`, "kcal / day"],
          ["Surplus needed", `+${dailySurplus}`, "kcal / day"],
          ["Expected gain", `${kgPerWeek}`, "kg / week"],
          [
            "Your avg (7d)",
            avgIntake ? `${avgIntake}` : "—",
            avgIntake ? `${actualSurplus > 0 ? "+" : ""}${actualSurplus} vs maintenance` : "no logs yet",
          ],
        ].map(([label, value, unit]) => (
          <div key={label} className="rounded-2xl bg-card/40 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
            <p className="text-[11px] text-muted-foreground">{unit}</p>
          </div>
        ))}
      </div>

      {avgIntake ? (
        <p className="mt-3 text-xs text-muted-foreground">
          At your current pace you&apos;d gain about{" "}
          <span className="text-foreground font-medium">{projectedKg} kg/week</span>.{" "}
          {gap > 50
            ? `Add roughly ${gap} kcal a day to hit ${kgPerWeek} kg/week — try milk, peanut butter or a rice top-up.`
            : gap < -50
              ? `You're about ${Math.abs(gap)} kcal a day above this pace — trim a little to keep the gain lean.`
              : "You're right on target — keep it steady."}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Log a few days of meals to compare your real intake against this target.
        </p>
      )}
    </div>
  );
}
