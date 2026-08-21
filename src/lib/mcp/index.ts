import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getNutritionTargets from "./tools/get-nutrition-targets";
import getFoodDiary from "./tools/get-food-diary";
import logMeal from "./tools/log-meal";
import logDailyStat from "./tools/log-daily-stat";
import getProgress from "./tools/get-progress";
import searchFoods from "./tools/search-foods";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gymie",
  title: "Gymie",
  version: "0.1.0",
  instructions:
    "Tools for Gymie, an AI nutrition tracker for Bangladeshi food. Use `get_nutrition_targets` for the user's goal and daily calorie/macro targets, `search_foods` to look up per-serving macros, `log_meal` to add foods to their diary, `get_food_diary` to read one day, `log_daily_stat` for water, weight and gym, and `get_progress` for recent trends. Dates are Asia/Dhaka YYYY-MM-DD and default to today.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getNutritionTargets, searchFoods, logMeal, getFoodDiary, logDailyStat, getProgress],
});
