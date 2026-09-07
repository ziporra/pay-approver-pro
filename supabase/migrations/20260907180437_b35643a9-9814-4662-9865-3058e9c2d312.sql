ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS monday_conflicts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS vendors_monday_contact_id_key
  ON public.vendors (monday_contact_id) WHERE monday_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_requests_vendor_invoice_idx
  ON public.payment_requests (vendor_id, invoice_number) WHERE invoice_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.monday_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  scanned integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  linked_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.monday_import_runs TO authenticated;
GRANT ALL ON public.monday_import_runs TO service_role;

ALTER TABLE public.monday_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view import runs"
  ON public.monday_import_runs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));