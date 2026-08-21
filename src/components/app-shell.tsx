import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Flame, LayoutDashboard, LineChart, LogOut, MessageCircle, Moon, Sparkles, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/dashboard", label: "Diary", icon: LayoutDashboard },
  { to: "/blueprint", label: "Blueprint", icon: Sparkles },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("gymie-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => {
        const next = !dark;
        setDark(next);
        localStorage.setItem("gymie-theme", next ? "dark" : "light");
        document.documentElement.classList.toggle("dark", next);
      }}
      className="glass grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function GymieMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="bg-accent-gradient grid size-8 place-items-center rounded-xl shadow-glow">
        <Flame className="size-4 text-primary-foreground" />
      </span>
      <span className="text-lg font-semibold tracking-tight">Gymie</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="bg-hero-glow pointer-events-none fixed inset-0 -z-10" />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-3 sm:px-4">
          <Link to="/chat">
            <GymieMark />
          </Link>
          <nav className="glass hidden items-center gap-1 rounded-full p-1 sm:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="bg-accent-gradient absolute inset-0 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="glass grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 pb-28 sm:px-4 sm:pb-10">{children}</main>

      <nav className="glass-strong fixed inset-x-2 bottom-2 z-30 flex items-center justify-around rounded-2xl py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
