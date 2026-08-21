export type Gender = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type GoalType = "lean_bulk" | "fat_loss" | "maintain" | "recomposition";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary — desk work, little movement",
  light: "Lightly active — light walking, 1-2 workouts",
  moderate: "Moderately active — 3-4 workouts a week",
  active: "Active — 5-6 workouts a week",
  very_active: "Very active — daily training or physical job",
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lean_bulk: "Lean Bulk",
  fat_loss: "Fat Loss",
  maintain: "Maintain",
  recomposition: "Recomposition",
};

export const GOAL_BLURB: Record<GoalType, string> = {
  lean_bulk: "Gain muscle with minimal fat — calorie surplus, high protein",
  fat_loss: "Drop fat while keeping muscle — moderate deficit",
  maintain: "Hold your current weight and stay consistent",
  recomposition: "Build muscle and lose fat at maintenance calories",
};

export type Biometrics = {
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  goal: string;
  gym_days_per_week?: number | null;
  daily_steps?: number | null;
};

export type Targets = {
  bmi: number;
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
};

export function calcBmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  if (!m) return 0;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiLabel(bmi: number) {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function computeTargets(b: Biometrics): Targets {
  const height = Number(b.height_cm) || 170;
  const weight = Number(b.weight_kg) || 60;
  const age = Number(b.age) || 25;
  const male = (b.gender ?? "male") !== "female";

  // Mifflin-St Jeor
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161));

  const factor =
    ACTIVITY_FACTORS[(b.activity_level as ActivityLevel) ?? "light"] ?? 1.375;
  const stepBonus = Math.min(250, Math.max(0, ((b.daily_steps ?? 5000) - 5000) / 20));
  const tdee = Math.round(bmr * factor + stepBonus);

  const goal = (b.goal as GoalType) ?? "maintain";
  const calories = Math.round(
    goal === "lean_bulk"
      ? tdee + 400
      : goal === "fat_loss"
        ? tdee - 450
        : goal === "recomposition"
          ? tdee + 50
          : tdee,
  );

  const proteinPerKg =
    goal === "lean_bulk" ? 2.0 : goal === "fat_loss" ? 2.2 : goal === "recomposition" ? 2.1 : 1.6;
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * (goal === "fat_loss" ? 0.27 : 0.25)) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const water = Math.round((weight * 35 + (b.gym_days_per_week ?? 0) * 60) / 50) * 50;

  return {
    bmi: calcBmi(weight, height),
    bmr,
    tdee,
    calories,
    protein,
    carbs,
    fat,
    water,
  };
}

export function dhakaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

export function mealTypeForNow(date = new Date()) {
  const hour = Number(
    date.toLocaleString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }),
  );
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 19) return "snack";
  return "dinner";
}
