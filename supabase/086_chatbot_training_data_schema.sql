CREATE TABLE IF NOT EXISTS public.chatbot_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_situation TEXT NOT NULL CHECK (length(trim(problem_situation)) > 0),
  solution TEXT NOT NULL CHECK (length(trim(solution)) > 0),
  registered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  registrant_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chatbot_training_data_updated_at_idx
  ON public.chatbot_training_data(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_chatbot_training_data_registrant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.registered_by := auth.uid();
  SELECT name INTO NEW.registrant_name
  FROM public.profiles
  WHERE id = auth.uid();

  IF NEW.registrant_name IS NULL THEN
    RAISE EXCEPTION '등록자 프로필을 찾을 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chatbot_training_data_set_registrant
  ON public.chatbot_training_data;
CREATE TRIGGER chatbot_training_data_set_registrant
  BEFORE INSERT ON public.chatbot_training_data
  FOR EACH ROW EXECUTE FUNCTION public.set_chatbot_training_data_registrant();

DROP TRIGGER IF EXISTS chatbot_training_data_updated_at
  ON public.chatbot_training_data;
CREATE TRIGGER chatbot_training_data_updated_at
  BEFORE UPDATE ON public.chatbot_training_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.chatbot_training_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read chatbot training data"
  ON public.chatbot_training_data;
CREATE POLICY "authenticated users can read chatbot training data"
  ON public.chatbot_training_data FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated users can create chatbot training data"
  ON public.chatbot_training_data;
CREATE POLICY "authenticated users can create chatbot training data"
  ON public.chatbot_training_data FOR INSERT TO authenticated
  WITH CHECK (registered_by = auth.uid());

DROP POLICY IF EXISTS "authenticated users can update chatbot training data"
  ON public.chatbot_training_data;
CREATE POLICY "authenticated users can update chatbot training data"
  ON public.chatbot_training_data FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.chatbot_training_data FROM anon;
REVOKE UPDATE ON public.chatbot_training_data FROM authenticated;
GRANT SELECT, INSERT ON public.chatbot_training_data TO authenticated;
GRANT UPDATE (problem_situation, solution) ON public.chatbot_training_data TO authenticated;
