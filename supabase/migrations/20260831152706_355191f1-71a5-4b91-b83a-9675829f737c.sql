-- 1. Profile identity fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_color text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"email_on_approval":true,"email_on_payment":true,"email_on_invoice":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- 2. Audit log enrichment
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS old_value_masked text,
  ADD COLUMN IF NOT EXISTS new_value_masked text;

CREATE INDEX IF NOT EXISTS audit_logs_payment_idx ON public.audit_logs(payment_request_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action, occurred_at DESC);

-- 3. Append-only audit writer (security definer; audit_logs has no INSERT policy)
CREATE OR REPLACE FUNCTION public.write_audit(
  _action text,
  _payment_request_id uuid DEFAULT NULL,
  _vendor_id uuid DEFAULT NULL,
  _field text DEFAULT NULL,
  _old_masked text DEFAULT NULL,
  _new_masked text DEFAULT NULL,
  _previous_status text DEFAULT NULL,
  _new_status text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _uid uuid := auth.uid();
  _email text;
  _name text;
  _role text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT p.email, coalesce(p.display_name, p.full_name) INTO _email, _name
  FROM public.profiles p WHERE p.id = _uid;
  SELECT r.role::text INTO _role FROM public.user_roles r WHERE r.user_id = _uid LIMIT 1;

  INSERT INTO public.audit_logs (
    actor_id, actor_label, actor_role, actor_email, action,
    payment_request_id, vendor_id, field, old_value_masked, new_value_masked,
    previous_status, new_status, metadata
  ) VALUES (
    _uid, coalesce(_name, _email), _role, _email, _action,
    _payment_request_id, _vendor_id, _field, _old_masked, _new_masked,
    _previous_status, _new_status, coalesce(_metadata, '{}'::jsonb)
  ) RETURNING id INTO _id;
  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.write_audit(text, uuid, uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_audit(text, uuid, uuid, text, text, text, text, text, jsonb) TO authenticated, service_role;

-- 4. Bank directory cache (public bank identity metadata only)
CREATE TABLE IF NOT EXISTS public.bank_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  bank_name text NOT NULL,
  swift_bic text,
  bank_address text,
  source text NOT NULL DEFAULT 'internal',
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, bank_name)
);

GRANT SELECT ON public.bank_directory TO authenticated;
GRANT SELECT ON public.bank_directory TO anon;
GRANT ALL ON public.bank_directory TO service_role;
ALTER TABLE public.bank_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bank directory is publicly readable"
  ON public.bank_directory FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER bank_directory_updated_at BEFORE UPDATE ON public.bank_directory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS bank_directory_country_name_idx ON public.bank_directory(country, lower(bank_name));

-- 5. Bank entry provenance
ALTER TABLE public.vendor_bank_accounts
  ADD COLUMN IF NOT EXISTS entry_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS directory_bank_id uuid REFERENCES public.bank_directory(id) ON DELETE SET NULL;