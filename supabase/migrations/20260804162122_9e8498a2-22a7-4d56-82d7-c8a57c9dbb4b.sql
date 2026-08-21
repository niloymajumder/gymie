-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  age integer,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  goal_weight_kg numeric,
  activity_level text,
  gym_days_per_week integer DEFAULT 0,
  daily_steps integer DEFAULT 5000,
  goal text,
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  target_water_ml integer,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FOODS (shared library)
CREATE TABLE public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_bn text,
  category text NOT NULL DEFAULT 'other',
  serving_label text NOT NULL DEFAULT '1 serving',
  serving_grams numeric,
  calories numeric NOT NULL,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  sugar_g numeric DEFAULT 0,
  sodium_mg numeric DEFAULT 0,
  is_curated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX foods_name_en_key ON public.foods (lower(name_en));
GRANT SELECT, INSERT ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foods_read" ON public.foods FOR SELECT TO authenticated USING (true);
CREATE POLICY "foods_insert" ON public.foods FOR INSERT TO authenticated WITH CHECK (true);

-- MEAL ENTRIES
CREATE TABLE public.meal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_type text NOT NULL DEFAULT 'snack',
  note text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_entries TO authenticated;
GRANT ALL ON public.meal_entries TO service_role;
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_entries_own" ON public.meal_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX meal_entries_user_day ON public.meal_entries (user_id, logged_on);

-- FOOD ITEMS
CREATE TABLE public.food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.meal_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_bn text,
  quantity_label text NOT NULL DEFAULT '1 serving',
  grams numeric,
  calories numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  sugar_g numeric DEFAULT 0,
  sodium_mg numeric DEFAULT 0,
  confidence text NOT NULL DEFAULT 'medium',
  is_estimated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_items TO authenticated;
GRANT ALL ON public.food_items TO service_role;
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_items_own" ON public.food_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX food_items_entry ON public.food_items (entry_id);

-- CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_own" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_user ON public.chat_messages (user_id, created_at);

-- WEIGHT LOGS
CREATE TABLE public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL,
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_logs TO authenticated;
GRANT ALL ON public.weight_logs TO service_role;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weight_logs_own" ON public.weight_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WATER LOGS
CREATE TABLE public.water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml integer NOT NULL,
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_logs TO authenticated;
GRANT ALL ON public.water_logs TO service_role;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "water_logs_own" ON public.water_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX water_logs_user_day ON public.water_logs (user_id, logged_on);

-- GYM LOGS
CREATE TABLE public.gym_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  attended boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_logs TO authenticated;
GRANT ALL ON public.gym_logs TO service_role;
ALTER TABLE public.gym_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gym_logs_own" ON public.gym_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SEED CURATED BANGLADESHI FOOD DATABASE
INSERT INTO public.foods (name_en, name_bn, category, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, is_curated) VALUES
('White Rice (cooked)','ভাত','lunch','1 plate',250,325,6.8,71,0.7,1,0.1,4,true),
('White Rice half plate','আধা প্লেট ভাত','lunch','half plate',125,163,3.4,35,0.4,0.5,0.1,2,true),
('Panta Bhat','পান্তা ভাত','breakfast','1 bowl',250,290,6,63,0.6,1,0.2,300,true),
('Khichuri','খিচুড়ি','breakfast','1 plate',300,420,14,62,12,5,1,620,true),
('Bhuna Khichuri','ভুনা খিচুড়ি','lunch','1 plate',300,520,16,66,20,5,1,700,true),
('Tehari','তেহারি','lunch','1 plate',300,640,24,72,28,3,2,900,true),
('Kacchi Biryani','কাচ্চি বিরিয়ানি','lunch','1 plate',400,880,34,92,42,3,3,1200,true),
('Chicken Biryani','চিকেন বিরিয়ানি','lunch','1 plate',350,690,30,80,28,3,3,1050,true),
('Morog Polao','মোরগ পোলাও','lunch','1 plate',350,720,32,78,32,2,4,980,true),
('Roti (atta)','রুটি','breakfast','1 piece',45,120,3.5,22,1.5,3,0.5,150,true),
('Paratha','পরোটা','breakfast','1 piece',60,260,4.5,32,12,2,1,300,true),
('Luchi','লুচি','breakfast','1 piece',30,145,2.5,15,8,0.6,0.3,120,true),
('Naan','নান','breakfast','1 piece',90,290,8,50,6,2,3,450,true),
('Chapati','চাপাতি','breakfast','1 piece',40,104,3,20,1.2,2.5,0.4,130,true),
('Masoor Dal','মসুর ডাল','lunch','1 bowl',200,150,9,20,3.5,5,1,480,true),
('Mug Dal','মুগ ডাল','lunch','1 bowl',200,160,10,22,3,5,1,470,true),
('Boot Dal','বুটের ডাল','lunch','1 bowl',200,220,11,28,7,6,2,520,true),
('Egg Bhaji','ডিম ভাজি','breakfast','1 egg',60,120,6.5,1,10,0,0.4,180,true),
('Boiled Egg','সিদ্ধ ডিম','breakfast','1 egg',50,78,6.3,0.6,5.3,0,0.6,62,true),
('Omelette (2 eggs)','ওমলেট','breakfast','1 serving',120,220,13,2,18,0,1,340,true),
('Egg Curry','ডিম কারি','lunch','1 piece',110,190,8,4,15,1,1,420,true),
('Rui Fish Curry','রুই মাছের ঝোল','lunch','1 piece',120,215,20,4,13,0.5,1,480,true),
('Ilish Fish (Hilsa) Curry','ইলিশ মাছ','lunch','1 piece',100,320,22,3,25,0,0.5,450,true),
('Katla Fish Curry','কাতলা মাছ','lunch','1 piece',120,210,19,4,13,0.5,1,470,true),
('Pangash Fish Curry','পাঙ্গাস মাছ','lunch','1 piece',120,260,17,4,19,0.5,1,460,true),
('Tilapia Fish Curry','তেলাপিয়া মাছ','lunch','1 piece',120,195,20,3,11,0.5,1,440,true),
('Chingri Malai Curry','চিংড়ি মালাইকারি','lunch','1 bowl',150,320,22,8,22,1,3,620,true),
('Shutki Bhorta','শুঁটকি ভর্তা','lunch','2 tbsp',40,120,10,3,7,1,0.5,700,true),
('Chicken Curry','চিকেন কারি','lunch','1 piece',120,240,22,5,14,1,1,520,true),
('Grilled Chicken Breast','গ্রিল চিকেন','lunch','1 piece',150,248,46,0,6,0,0,420,true),
('Fried Chicken','ফ্রাইড চিকেন','snack','1 piece',120,340,20,14,22,1,1,680,true),
('Chicken Roast','চিকেন রোস্ট','lunch','1 piece',150,420,28,10,29,1,4,760,true),
('Beef Bhuna','গরুর ভুনা','lunch','1 bowl',150,420,28,6,32,1,1,640,true),
('Beef Curry','গরুর মাংস','lunch','1 bowl',150,380,26,5,29,1,1,620,true),
('Mutton Curry','খাসির মাংস','lunch','1 bowl',150,400,25,5,31,1,1,610,true),
('Beef Kala Bhuna','কালা ভুনা','lunch','1 bowl',150,470,29,7,37,1,1,700,true),
('Vegetable Curry (mixed)','সবজি','lunch','1 bowl',150,120,3,14,6,4,4,380,true),
('Aloo Bhorta','আলু ভর্তা','lunch','2 tbsp',60,110,1.5,13,6,1.5,0.6,260,true),
('Begun Bhaji','বেগুন ভাজি','lunch','1 piece',60,95,1,7,7,2,2,180,true),
('Shak Bhaji','শাক ভাজি','lunch','1 bowl',100,90,3,8,5,3,1,240,true),
('Data Shak','ডাঁটা শাক','lunch','1 bowl',100,70,2.5,7,3.5,3,1,220,true),
('Cucumber Salad','শসার সালাদ','lunch','1 bowl',100,25,1,5,0.2,1,2,60,true),
('Halim','হালিম','snack','1 bowl',250,380,22,36,16,5,2,880,true),
('Fuchka','ফুচকা','street','1 plate (6 pcs)',120,280,7,42,9,4,3,520,true),
('Chotpoti','চটপটি','street','1 plate',200,320,12,46,10,7,4,760,true),
('Singara','সিঙ্গাড়া','street','1 piece',70,220,4,24,12,2,1,320,true),
('Samosa','সমুচা','street','1 piece',60,190,4,20,11,2,1,300,true),
('Jhalmuri','ঝালমুড়ি','street','1 packet',80,290,6,42,11,3,2,540,true),
('Chicken Roll','চিকেন রোল','street','1 piece',150,380,16,38,18,2,3,720,true),
('Beef Burger','বার্গার','street','1 piece',220,560,26,48,29,3,8,980,true),
('Chicken Shawarma','শাওয়ারমা','street','1 piece',250,620,32,52,30,4,5,1150,true),
('Piyaju','পিঁয়াজু','street','1 piece',30,85,3,9,4,2,0.5,150,true),
('Beguni','বেগুনি','street','1 piece',35,95,1.5,10,5.5,1.5,0.7,160,true),
('Chicken Fry Bun','চিকেন বান','street','1 piece',120,330,12,38,14,2,5,520,true),
('Mishti (Sandesh)','মিষ্টি','dessert','1 piece',40,145,3,20,5.5,0,18,25,true),
('Rosogolla','রসগোল্লা','dessert','1 piece',50,186,3,32,5,0,30,30,true),
('Jilapi','জিলাপি','dessert','1 piece',45,180,1,32,6,0,26,20,true),
('Firni','ফিরনি','dessert','1 bowl',120,230,5,36,7,0.5,26,80,true),
('Payesh','পায়েস','dessert','1 bowl',150,280,6,44,9,0.5,30,95,true),
('Pitha (Bhapa)','ভাপা পিঠা','dessert','1 piece',80,190,3,38,3,1,16,60,true),
('Chitoi Pitha','চিতই পিঠা','dessert','1 piece',60,120,2.5,26,0.8,0.8,1,40,true),
('Borhani','বোরহানি','drink','1 glass',250,120,5,14,4,0.3,12,420,true),
('Cha (milk tea)','দুধ চা','drink','1 cup',150,90,2,12,3.5,0,11,35,true),
('Rong Cha (black tea)','রঙ চা','drink','1 cup',150,25,0,6,0,0,6,5,true),
('Black Coffee','ব্ল্যাক কফি','drink','1 cup',240,5,0.3,0,0,0,0,5,true),
('Lassi','লাচ্ছি','drink','1 glass',250,220,7,34,6,0.3,30,110,true),
('Coconut Water','ডাবের পানি','drink','1 glass',250,45,1.7,9,0.5,2.6,6,250,true),
('Soft Drink (Coke)','কোক','drink','1 can',330,139,0,35,0,0,35,15,true),
('Sugarcane Juice','আখের রস','drink','1 glass',250,180,0.3,43,0.2,0.3,42,30,true),
('Milk (full cream)','দুধ','drink','1 glass',250,150,8,12,8,0,12,105,true),
('Banana','কলা','snack','1 medium',118,105,1.3,27,0.4,3.1,14,1,true),
('Apple','আপেল','snack','1 medium',180,95,0.5,25,0.3,4.4,19,2,true),
('Mango','আম','snack','1 medium',200,200,2.8,50,1.3,5.4,45,3,true),
('Peanut Butter','পিনাট বাটার','snack','1 tbsp',16,94,4,3,8,1,1.5,75,true),
('Bread Toast','পাউরুটি','breakfast','1 slice',28,75,2.6,14,1,0.8,1.5,145,true),
('Chira (flattened rice)','চিড়া','breakfast','1 bowl',60,210,4.5,46,0.8,1.5,0.5,10,true),
('Muri (puffed rice)','মুড়ি','snack','1 bowl',30,115,2,26,0.3,0.5,0.2,5,true),
('Yogurt (Doi)','দই','dessert','1 bowl',150,150,7,18,5,0,17,80,true),
('Mishti Doi','মিষ্টি দই','dessert','1 bowl',150,240,6,42,5,0,38,85,true),
('Whey Protein Scoop','হুই প্রোটিন','snack','1 scoop',30,120,24,3,1.5,0.5,1,60,true),
('Chicken Khichuri','চিকেন খিচুড়ি','lunch','1 plate',350,580,28,68,22,4,2,880,true);