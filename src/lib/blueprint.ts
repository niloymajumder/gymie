import { calcBmi, type GoalType } from "@/lib/nutrition";

export type FrameType = "very_lean" | "lean" | "athletic" | "recomp";

export type FrameRead = {
  type: FrameType;
  label: string;
  summary: string;
  bmi: number;
  toGoalKg: number;
  weeklyGainKg: { min: number; max: number };
};

export function readFrame(input: {
  height_cm?: number | null;
  weight_kg?: number | null;
  goal_weight_kg?: number | null;
  goal?: string | null;
}): FrameRead {
  const height = Number(input.height_cm) || 170;
  const weight = Number(input.weight_kg) || 60;
  const goalWeight = Number(input.goal_weight_kg) || weight;
  const goal = (input.goal as GoalType) ?? "maintain";
  const bmi = calcBmi(weight, height);
  const toGoalKg = Math.round((goalWeight - weight) * 10) / 10;

  const type: FrameType =
    bmi < 18.5
      ? "very_lean"
      : goal === "recomposition"
        ? "recomp"
        : bmi < 22
          ? "lean"
          : "athletic";

  const label = {
    very_lean: "Ectomorph — very lean frame",
    lean: "Ectomorph-leaning — slim frame",
    athletic: "Balanced frame",
    recomp: "Recomposition frame",
  }[type];

  const summary = {
    very_lean:
      "You have a fast metabolism and low body fat. Your bottleneck is calories in, not training volume — eat above maintenance every single day and let heavy compounds do the shaping.",
    lean: "You are slim with room to add solid mass. Consistent surplus plus progressive overload will show visible change in 8–12 weeks.",
    athletic:
      "You carry a decent base. Push strength on the big lifts and keep the surplus small so the gain stays lean.",
    recomp:
      "You are building muscle and shedding fat at the same time. Protein and lifting consistency matter more than calories here.",
  }[type];

  const weeklyGainKg = { min: Math.round(weight * 0.0025 * 100) / 100, max: Math.round(weight * 0.005 * 100) / 100 };

  return { type, label, summary, bmi, toGoalKg, weeklyGainKg };
}

export type SplitDay = { day: string; focus: string; lifts: string[] };

export function trainingSplit(gymDays: number): { name: string; note: string; days: SplitDay[] } {
  const push: SplitDay = {
    day: "Push",
    focus: "Chest · Shoulders · Triceps",
    lifts: [
      "Barbell bench press — 4 × 5-8",
      "Incline dumbbell press — 3 × 8-12",
      "Overhead press — 3 × 6-10",
      "Lateral raise — 3 × 12-15",
      "Triceps rope pushdown — 3 × 10-15",
    ],
  };
  const pull: SplitDay = {
    day: "Pull",
    focus: "Back · Rear delts · Biceps",
    lifts: [
      "Weighted pull-up or lat pulldown — 4 × 6-10",
      "Barbell row — 4 × 6-10",
      "Seated cable row — 3 × 10-12",
      "Face pull — 3 × 15",
      "Barbell curl — 3 × 8-12",
    ],
  };
  const legs: SplitDay = {
    day: "Legs",
    focus: "Quads · Hamstrings · Glutes · Calves",
    lifts: [
      "Back squat — 4 × 5-8",
      "Romanian deadlift — 3 × 8-10",
      "Leg press — 3 × 10-12",
      "Leg curl — 3 × 10-15",
      "Standing calf raise — 4 × 12-20",
    ],
  };
  const upper: SplitDay = {
    day: "Upper",
    focus: "Full upper body",
    lifts: [
      "Bench press — 4 × 5-8",
      "Barbell row — 4 × 6-10",
      "Overhead press — 3 × 8-10",
      "Lat pulldown — 3 × 10-12",
      "Curl + pushdown superset — 3 × 12",
    ],
  };
  const lower: SplitDay = {
    day: "Lower",
    focus: "Legs · Core",
    lifts: [
      "Squat — 4 × 5-8",
      "Deadlift — 3 × 3-5",
      "Walking lunge — 3 × 10 each",
      "Leg curl — 3 × 12",
      "Hanging leg raise — 3 × 12",
    ],
  };
  const fullBody: SplitDay = {
    day: "Full body",
    focus: "One big push, pull and leg movement",
    lifts: [
      "Squat or deadlift — 4 × 5",
      "Bench or overhead press — 4 × 6-8",
      "Row or pull-up — 4 × 6-10",
      "Accessory of choice — 2 × 12",
    ],
  };

  if (gymDays >= 6)
    return {
      name: "Push / Pull / Legs ×2",
      note: "Six sessions. Only run this if sleep and food are dialled in — recovery is the limiter, not effort.",
      days: [push, pull, legs, { ...push, day: "Push (2)" }, { ...pull, day: "Pull (2)" }, { ...legs, day: "Legs (2)" }],
    };
  if (gymDays === 5)
    return {
      name: "Upper / Lower / Push / Pull / Legs",
      note: "Five sessions with each muscle hit roughly twice a week. Best growth-per-hour split for a slim frame.",
      days: [upper, lower, push, pull, legs],
    };
  if (gymDays === 4)
    return {
      name: "Upper / Lower ×2",
      note: "Four sessions, everything trained twice a week. The sweet spot when you also want a life outside the gym.",
      days: [upper, lower, { ...upper, day: "Upper (2)" }, { ...lower, day: "Lower (2)" }],
    };
  if (gymDays === 3)
    return {
      name: "Full body ×3",
      note: "Three sessions, every muscle three times a week. Ideal when you are new and want the fastest strength curve.",
      days: [
        { ...fullBody, day: "Day A" },
        { ...fullBody, day: "Day B" },
        { ...fullBody, day: "Day C" },
      ],
    };
  return {
    name: "Full body ×2",
    note: "Two sessions is the minimum that still builds. Make both count — heavy compounds only, no filler.",
    days: [
      { ...fullBody, day: "Day A" },
      { ...fullBody, day: "Day B" },
    ],
  };
}

export const TRAINING_RULES = [
  {
    title: "Progress by reps, then weight",
    body: "Stay at the same load until you hit the top of the rep range on every set. Then add 2.5 kg and drop back to the bottom of the range.",
  },
  {
    title: "Rest 2–3 minutes on compounds",
    body: "Short rests feel productive but cut your load. On squats, bench, rows and presses, wait until you actually feel ready.",
  },
  {
    title: "Cap cardio at 2 easy sessions",
    body: "As a skinny gainer, cardio eats the surplus you fought to eat. Walking is fine — long runs are not, while you are bulking.",
  },
  {
    title: "Sleep 7.5–9 hours",
    body: "Growth happens in bed. One bad week of sleep costs more than one bad week of training.",
  },
  {
    title: "Log every set",
    body: "If you cannot say what you lifted last week, you cannot beat it. Write it down before you leave the rack.",
  },
];

export const GEAR = {
  now: [
    { item: "Flat-soled shoes", why: "Converse-style or lifting flats. Running shoes wobble under squats." },
    { item: "Shaker bottle", why: "Protein right after training is one less meal to think about." },
    { item: "Tape measure", why: "Chest, arm and waist every 2 weeks tells you if the gain is muscle or belly." },
    { item: "Breathable tee + shorts", why: "Dhaka gyms get hot. Cotton soaks and drags — go for dry-fit." },
  ],
  later: [
    { item: "Lifting belt", why: "Once your squat or deadlift passes roughly 1.25× bodyweight." },
    { item: "Lifting straps", why: "When grip fails before your back does on heavy rows and pulls." },
    { item: "Knee sleeves", why: "For heavy squat days and cooler joints in winter." },
    { item: "Resistance bands", why: "Warm-ups, face pulls, and home sessions when you cannot make the gym." },
  ],
};

export const FUELING = [
  {
    title: "Pre-workout, 60–90 min before",
    body: "Rice or bread with a lean protein — bhat with chicken, or 2 toast with eggs. Carbs give you the extra reps.",
  },
  {
    title: "Post-workout, within 2 hours",
    body: "30–40 g protein plus carbs. Milk with banana and peanut butter is the cheapest option in Dhaka.",
  },
  {
    title: "Before bed",
    body: "A glass of full-fat milk with 1 tbsp peanut butter adds ~250 kcal you will not even notice.",
  },
  {
    title: "Low appetite? Drink your calories",
    body: "Blend milk, oats, banana, peanut butter and dates. Easier to sip 600 kcal than to chew it.",
  },
];

export const STYLE = {
  fit: [
    {
      title: "Shoulder seam sits on the bone",
      body: "The single biggest fit rule for a slim frame. A seam that hangs past the shoulder makes you look smaller, not bigger.",
    },
    {
      title: "Slim, not skinny",
      body: "Skinny fits shrink-wrap a narrow frame. Slim-straight cuts hold shape and read fuller.",
    },
    {
      title: "Sleeve ends mid-bicep",
      body: "A tee sleeve that stops at the widest part of your arm frames it. Long, loose sleeves erase it.",
    },
    {
      title: "Shorter hems",
      body: "Tees ending at mid-fly and jackets ending at the hip make your torso read broader and your legs longer.",
    },
    {
      title: "Slight trouser break",
      body: "One clean break at the shoe. Extra fabric puddling at the ankle makes the whole silhouette look thin.",
    },
  ],
  volume: [
    {
      title: "Layer, always",
      body: "An overshirt or unbuttoned shirt over a tee adds two visual inches across the chest with zero effort.",
    },
    {
      title: "Horizontal detail up top",
      body: "Chest stripes, breast pockets, contrast yokes — anything that draws the eye sideways across your chest.",
    },
    {
      title: "Textured, heavier fabrics",
      body: "Oxford cotton, denim, knit polos and flannel hold structure. Thin viscose and clingy jersey cling and shrink you.",
    },
    {
      title: "Crew and boat necks over deep V",
      body: "A high neckline shortens the visible chest gap and widens the shoulder line.",
    },
    {
      title: "Colour blocking",
      body: "Lighter top with darker bottoms puts the visual weight where you want it.",
    },
  ],
  avoid: [
    "Oversized/baggy streetwear tees — they swallow a slim frame",
    "Deep V-necks and wide scoop necks",
    "Thin clingy fabrics with no structure",
    "Vertical pinstripes head to toe",
    "Skinny jeans with a slim upper body",
  ],
  buyFirst: [
    "2 well-fitting crew tees (one white, one navy)",
    "1 oxford shirt to wear open as a layer",
    "1 slim-straight dark denim",
    "1 lightweight overshirt for Dhaka evenings",
    "1 knit polo — structure without heat",
  ],
};
