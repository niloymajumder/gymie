CREATE TABLE public.chat_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_drafts TO authenticated;
GRANT ALL ON public.chat_drafts TO service_role;
ALTER TABLE public.chat_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_drafts_own ON public.chat_drafts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER chat_drafts_updated_at BEFORE UPDATE ON public.chat_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.blueprint_insights (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blueprint_insights TO authenticated;
GRANT ALL ON public.blueprint_insights TO service_role;
ALTER TABLE public.blueprint_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY blueprint_insights_own ON public.blueprint_insights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER blueprint_insights_updated_at BEFORE UPDATE ON public.blueprint_insights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();