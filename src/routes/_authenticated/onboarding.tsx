import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { getProfile, saveProfile } from "@/lib/gymie.functions";
import {
  ACTIVITY_LABELS,
  GOAL_BLURB,
  GOAL_LABELS,
  bmiLabel,
  computeTargets,
  type ActivityLevel,
  type GoalType,
} from "@/lib/nutrition";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your Gymie profile" },
      {
        name: "description",
        content: "Tell Gymie your body stats and goal to get personalised calorie and macro targets.",
      },
      { property: "og:title", content: "Set up your Gymie profile" },
      { property: "og:description", content: "Personalised calorie and macro targets in two minutes." },
    ],
  }),
  component: Onboarding,
});

type FormState = {
  name: string;
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg: number;
  activity_level: ActivityLevel;
  gym_days_per_week: number;
  daily_steps: number;
  goal: GoalType;
};

const STEPS = ["You", "Body", "Activity", "Goal"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const persist = useServerFn(saveProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    name: "",
    age: 24,
    gender: "male",
    height_cm: 172,
    weight_kg: 58,
    goal_weight_kg: 68,
    activity_level: "moderate",
    gym_days_per_week: 4,
    daily_steps: 6000,
    goal: "lean_bulk",
  });

  useEffect(() => {
    if (!profile) return;
    setForm((prev) => ({
      ...prev,
      name: profile.name || prev.name,
      age: profile.age ?? prev.age,
      gender: profile.gender ?? prev.gender,
      height_cm: profile.height_cm ?? prev.height_cm,
      weight_kg: profile.weight_kg ?? prev.weight_kg,
      goal_weight_kg: profile.goal_weight_kg ?? prev.goal_weight_kg,
      activity_level: (profile.activity_level as ActivityLevel) ?? prev.activity_level,
      gym_days_per_week: profile.gym_days_per_week ?? prev.gym_days_per_week,
      daily_steps: profile.daily_steps ?? prev.daily_steps,
      goal: (profile.goal as GoalType) ?? prev.goal,
    }));
  }, [profile]);

  const targets = useMemo(() => computeTargets(form), [form]);

  const save = useMutation({
    mutationFn: () => persist({ data: form }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Targets locked in. Let's eat.");
      navigate({ to: "/chat" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const numberField = (
    key: keyof FormState,
    label: string,
    suffix: string,
    step_ = 1,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={String(key)}>{label}</Label>
      <div className="relative">
        <Input
          id={String(key)}
          type="number"
          step={step_}
          value={String(form[key])}
          onChange={(event) => set(key, Number(event.target.value) as never)}
          className="rounded-xl pr-14"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-xl py-8">
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  index <= step ? "bg-accent-gradient" : "bg-muted",
                )}
              />
            </div>
          ))}
        </div>

        <div className="glass-strong rounded-3xl p-4 shadow-soft sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {step === 0 && (
                <>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">What should I call you?</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Gymie coaches you by name — in English or Bangla.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      placeholder="e.g. Rafi"
                      className="rounded-xl"
                    />
                  </div>
                  {numberField("age", "Age", "yrs")}
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {["male", "female"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => set("gender", option)}
                          className={cn(
                            "rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors",
                            form.gender === option
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Your body right now</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Used for BMI, BMR and your daily calorie target.
                    </p>
                  </div>
                  {numberField("height_cm", "Height", "cm")}
                  {numberField("weight_kg", "Current weight", "kg", 0.1)}
                  {numberField("goal_weight_kg", "Goal weight", "kg", 0.1)}
                  <div className="glass rounded-2xl p-4 text-sm">
                    BMI <span className="font-semibold">{targets.bmi}</span> ·{" "}
                    <span className="text-muted-foreground">{bmiLabel(targets.bmi)}</span>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">How active are you?</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Be honest — accuracy beats ego.</p>
                  </div>
                  <div className="space-y-2">
                    {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => set("activity_level", level)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                          form.activity_level === level
                            ? "border-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {ACTIVITY_LABELS[level]}
                      </button>
                    ))}
                  </div>
                  {numberField("gym_days_per_week", "Gym days per week", "days")}
                  {numberField("daily_steps", "Average daily steps", "steps", 500)}
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">What are we chasing?</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This sets your calorie and protein split.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(GOAL_LABELS) as GoalType[]).map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => set("goal", goal)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          form.goal === goal
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <p className="text-sm font-semibold">{GOAL_LABELS[goal]}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{GOAL_BLURB[goal]}</p>
                      </button>
                    ))}
                  </div>

                  <div className="glass grid grid-cols-2 gap-3 rounded-2xl p-4 text-sm sm:grid-cols-4">
                    {[
                      ["Calories", `${targets.calories}`, "kcal"],
                      ["Protein", `${targets.protein}`, "g"],
                      ["Carbs", `${targets.carbs}`, "g"],
                      ["Fat", `${targets.fat}`, "g"],
                    ].map(([label, value, unit]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-semibold">
                          {value}
                          <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
                        </p>
                      </div>
                    ))}
                    <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">
                      BMR {targets.bmr} kcal · TDEE {targets.tdee} kcal · Water {targets.water} ml/day
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-7 flex items-center justify-between gap-3 pb-1">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              className="rounded-xl"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => setStep((value) => value + 1)}
                className="bg-accent-gradient rounded-xl text-primary-foreground shadow-glow"
              >
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate()}
                className="bg-accent-gradient rounded-xl text-primary-foreground shadow-glow"
              >
                <Check className="size-4" /> {save.isPending ? "Saving…" : "Start tracking"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
