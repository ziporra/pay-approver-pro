CREATE POLICY "No client access to form hits"
  ON public.public_form_hits FOR SELECT TO authenticated
  USING (false);