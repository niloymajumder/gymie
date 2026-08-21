import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dumbbell,
  Shirt,
  Sparkles,
  RefreshCw,
  Target,
  UtensilsCrossed,
  ShoppingBag,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getBlueprintInsight, generateBlueprintInsight, getProfile } from "@/lib/gymie.functions";
import { readFrame, trainingSplit, TRAINING_RULES, GEAR, FUELING, STYLE } from "@/lib/blueprint";
import { GOAL_LABELS, bmiLabel, type GoalType } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/blueprint")({
  head: () => ({
    meta: [
      { title: "Blueprint — training & style for your frame | Gymie" },
      {
        name: "description",
        content:
          "A training split, gym gear list and style guide built around your body type, plus AI coaching from your own logs.",
      },
      { property: "og:title", content: "Gymie Blueprint" },
      {
        property: "og:description",
        content: "Lean-bulk training, fueling and style advice matched to your frame.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlueprintPage,
});

const TABS = [
  { id: "gym", label: "Gym", icon: Dumbbell },
  { id: "style", label: "Style", icon: Shirt },
] as const;

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-3xl p-4 sm:p-6", className)}>{children}</div>;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function BlueprintPage() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchInsight = useServerFn(getBlueprintInsight);
  const makeInsight = useServerFn(generateBlueprintInsight);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("gym");

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });
  const { data: insight } = useQuery({
    queryKey: ["blueprint-insight"],
    queryFn: () => fetchInsight({}),
  });

  const regenerate = useMutation({
    mutationFn: () => makeInsight({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["blueprint-insight"] });
      toast.success("Fresh plan ready");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't generate right now"),
  });

  const frame = readFrame(profile ?? {});
  const gymDays = Number(profile?.gym_days_per_week ?? 3);
  const split = trainingSplit(gymDays);
  const goal = (profile?.goal as GoalType) ?? "lean_bulk";

  const bullets = (insight?.content ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <AppShell>
      <div className="space-y-5 py-4 sm:space-y-6 sm:py-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">Blueprint</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Training, gear and style built around your frame.
            </p>
          </div>
          <span className="bg-accent-gradient shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {GOAL_LABELS[goal] ?? "Lean Bulk"}
          </span>
        </header>

        {/* Frame read */}
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Target className="size-4 shrink-0" /> Your frame
          </div>
          <p className="mt-3 text-lg font-semibold">{frame.label}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{frame.summary}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Weight", value: profile?.weight_kg ? `${profile.weight_kg} kg` : "—" },
              { label: "BMI", value: frame.bmi ? `${frame.bmi} · ${bmiLabel(frame.bmi)}` : "—" },
              {
                label: "To goal",
                value: frame.toGoalKg ? `${frame.toGoalKg > 0 ? "+" : ""}${frame.toGoalKg} kg` : "At goal",
              },
              {
                label: "Target pace",
                value: `${frame.weeklyGainKg.min}–${frame.weeklyGainKg.max} kg/wk`,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-secondary/50 p-3">
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className="mt-1 truncate text-sm font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* AI for you */}
        <Card className="border-primary/30">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <span className="truncate">For you, right now</span>
            </div>
            <button
              type="button"
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
              className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", regenerate.isPending && "animate-spin")} />
              {insight ? "Refresh" : "Generate"}
            </button>
          </div>

          {bullets.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {bullets.map((line, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="bg-accent-gradient mt-1.5 size-2 shrink-0 rounded-full" />
                  <span className="min-w-0">
                    <Inline text={line} />
                  </span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {regenerate.isPending
                ? "Reading your last two weeks of logs…"
                : "Generate a plan from your last two weeks of meals, training and weight."}
            </p>
          )}
        </Card>

        {/* Tabs */}
        <div className="glass flex w-full gap-1 rounded-full p-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="blueprint-tab"
                    className="bg-accent-gradient absolute inset-0 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative size-4" />
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>

        {tab === "gym" ? (
          <div className="space-y-5">
            <Card>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Your split
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold">{split.name}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                  {gymDays || 2} days/wk
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{split.note}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {split.days.map((day) => (
                  <div key={day.day} className="rounded-2xl bg-secondary/50 p-4">
                    <p className="text-sm font-semibold">{day.day}</p>
                    <p className="text-[11px] text-muted-foreground">{day.focus}</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {day.lifts.map((lift) => (
                        <li key={lift} className="text-xs leading-relaxed text-muted-foreground">
                          {lift}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Rules that matter most
              </p>
              <div className="mt-3 space-y-3">
                {TRAINING_RULES.map((rule) => (
                  <div key={rule.title} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{rule.title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{rule.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <UtensilsCrossed className="size-4 shrink-0" /> Fueling around training
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {FUELING.map((tip) => (
                  <div key={tip.title} className="rounded-2xl bg-secondary/50 p-4">
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tip.body}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <ShoppingBag className="size-4 shrink-0" /> Gear
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Get now", GEAR.now],
                    ["Later, when you need it", GEAR.later],
                  ] as const
                ).map(([label, list]) => (
                  <div key={label}>
                    <p className="text-sm font-medium">{label}</p>
                    <ul className="mt-2 space-y-2">
                      {list.map((entry) => (
                        <li key={entry.item} className="rounded-xl bg-secondary/50 p-3">
                          <p className="text-xs font-medium">{entry.item}</p>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">{entry.why}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-5">
            <Card>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Fit rules for a slim frame
              </p>
              <div className="mt-3 space-y-3">
                {STYLE.fit.map((tip) => (
                  <div key={tip.title} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{tip.title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{tip.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Add visual weight
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {STYLE.volume.map((tip) => (
                  <div key={tip.title} className="rounded-2xl bg-secondary/50 p-4">
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tip.body}</p>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-5 sm:grid-cols-2">
              <Card>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Skip these
                </p>
                <ul className="mt-3 space-y-2">
                  {STYLE.avoid.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Buy these first
                </p>
                <ul className="mt-3 space-y-2">
                  {STYLE.buyFirst.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
