import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { AppShell } from "@/components/app-shell";
import { getHistory, getProfile, logWeight } from "@/lib/gymie.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bmiLabel, calcBmi } from "@/lib/nutrition";
import { SurplusCalculator } from "@/components/surplus-calculator";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Gymie" },
      { name: "description", content: "Weight trend, weekly calories and consistency on Gymie." },
      { property: "og:title", content: "Your Gymie progress" },
      { property: "og:description", content: "Weight trend, calorie averages and gym consistency." },
    ],
  }),
  component: Progress,
});

function Progress() {
  const queryClient = useQueryClient();
  const fetchHistory = useServerFn(getHistory);
  const fetchProfile = useServerFn(getProfile);
  const saveWeight = useServerFn(logWeight);
  const [weight, setWeight] = useState("");

  const { data: history } = useQuery({ queryKey: ["history"], queryFn: () => fetchHistory({}) });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });

  const record = useMutation({
    mutationFn: (weight_kg: number) => saveWeight({ data: { weight_kg } }),
    onSuccess: () => {
      setWeight("");
      void queryClient.invalidateQueries();
    },
  });

  const days = history?.days ?? [];
  const last7 = days.slice(-7);
  const avgCalories = last7.length
    ? Math.round(last7.reduce((sum, d) => sum + d.calories, 0) / last7.length)
    : 0;
  const avgProtein = last7.length
    ? Math.round(last7.reduce((sum, d) => sum + d.protein, 0) / last7.length)
    : 0;
  const gymDays = last7.filter((d) => d.gym).length;
  const weights = history?.weights ?? [];
  const change =
    weights.length > 1
      ? Math.round(((weights.at(-1)?.weight ?? 0) - (weights[0]?.weight ?? 0)) * 10) / 10
      : 0;
  const bmi = profile?.weight_kg && profile?.height_cm
    ? calcBmi(profile.weight_kg, profile.height_cm)
    : 0;

  return (
    <AppShell>
      <div className="space-y-4 py-4 sm:py-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Progress</h1>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Avg calories", `${avgCalories}`, "kcal / day"],
            ["Avg protein", `${avgProtein}`, "g / day"],
            ["Gym", `${gymDays}/7`, "days"],
            ["Weight change", `${change > 0 ? "+" : ""}${change}`, "kg"],
          ].map(([label, value, unit]) => (
            <div key={label} className="glass rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">{value}</p>
              <p className="text-xs text-muted-foreground">{unit}</p>
            </div>
          ))}
        </div>

        <SurplusCalculator profile={profile ?? null} last7Calories={last7.map((d) => d.calories)} />


        <div className="glass-strong rounded-3xl p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Weight trend</h2>
              <p className="text-xs text-muted-foreground">
                BMI {bmi} · {bmiLabel(bmi)} · goal {profile?.goal_weight_kg ?? "—"} kg
              </p>
            </div>
            <div className="flex min-w-0 gap-2">
              <Input
                type="number"
                step="0.1"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="kg"
                className="w-full rounded-xl sm:w-24"
              />
              <Button
                className="bg-accent-gradient shrink-0 rounded-xl text-primary-foreground"
                disabled={!weight || record.isPending}
                onClick={() => record.mutate(Number(weight))}
              >
                Log
              </Button>
            </div>
          </div>
          <div className="mt-4 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weights}>
                <XAxis dataKey="day" hide />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} width={32} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Daily calories (30 days)</h2>
          <div className="mt-4 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <XAxis dataKey="day" hide />
                <YAxis width={36} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="calories" fill="var(--carbs)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
