import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect } from "react";
import { ArrowRight, Bot, Flame, HeartPulse, Sparkles, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GymieMark, ThemeToggle } from "@/components/app-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gymie — AI Calorie & Nutrition Tracker for Bangladesh" },
      {
        name: "description",
        content:
          "Log meals by chatting in Bangla or English. Gymie estimates calories, protein and macros for bhat, dal, ilish, kacchi, fuchka and more.",
      },
      { property: "og:title", content: "Gymie — AI Nutrition Coach for Bangladesh" },
      {
        property: "og:description",
        content:
          "Just type what you ate. Gymie tracks calories, macros, water, weight and coaches your lean bulk or fat loss.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Bot,
    title: "Talk, don't tap",
    body: "“Lunch e ek plate bhat, ek piece grilled chicken ar dal kheyechi” — logged in seconds.",
  },
  {
    icon: Utensils,
    title: "Built on desi food",
    body: "Kacchi, khichuri, ilish, fuchka, singara, cha — curated Bangladeshi nutrition data.",
  },
  {
    icon: HeartPulse,
    title: "Knows your numbers",
    body: "BMR, TDEE and macro targets calculated from your body and goal, updated as you change.",
  },
  {
    icon: Sparkles,
    title: "Coaches, not counts",
    body: "Confidence scores, protein nudges and weekly plain-language insights on your progress.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="bg-hero-glow pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <GymieMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/auth"
            className="bg-accent-gradient rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Start free
          </Link>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl px-4 pb-24">
        <section className="pt-14 sm:pt-24">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <Flame className="size-3.5 text-primary" />
            Made for Bangladeshi plates
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Calorie tracking that feels like
            <span className="text-accent-gradient"> a conversation.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Tell Gymie what you ate in Bangla or English. It figures out portions, calories,
            protein and macros — then coaches you toward your lean bulk, fat loss or
            recomposition goal.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/auth"
              className="bg-accent-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Start tracking free <ArrowRight className="size-4" />
            </Link>
            <span className="text-xs text-muted-foreground">
              No forms. No food lists. Just type.
            </span>
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="glass-strong mt-14 space-y-4 rounded-3xl p-5 shadow-soft sm:p-8"
        >
          <div className="flex justify-end">
            <p className="bg-accent-gradient max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm font-medium text-primary-foreground">
              Dupure ek plate bhat, rui macher jhol ar ekta dim kheyechi
            </p>
          </div>
          <div className="max-w-[85%] space-y-2 text-sm">
            <p className="font-medium">Logged your lunch 🍚</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Bhat / rice — 1 plate (250g) — 325 kcal</li>
              <li>• Rui fish curry — 1 piece — 185 kcal</li>
              <li>• Boiled egg — 1 — 78 kcal</li>
            </ul>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">588 kcal</span> · 34g protein · 62g
              carbs · 21g fat. You need 46g more protein today — a glass of milk with dinner
              covers most of it.
            </p>
          </div>
        </motion.section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.06 }}
              className="glass rounded-3xl p-6"
            >
              <feature.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </motion.div>
          ))}
        </section>
      </main>
    </div>
  );
}
