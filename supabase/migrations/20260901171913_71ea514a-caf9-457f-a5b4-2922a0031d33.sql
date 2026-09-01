ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS monday_item_id text,
  ADD COLUMN IF NOT EXISTS monday_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS monday_sync_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS monday_contact_id text,
  ADD COLUMN IF NOT EXISTS monday_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_requests_monday_item_idx ON public.payment_requests (monday_item_id);
CREATE INDEX IF NOT EXISTS vendors_monday_contact_idx ON public.vendors (monday_contact_id);

ALTER TABLE public.monday_sync_logs
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'payment_request',
  ADD COLUMN IF NOT EXISTS board_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS monday_sync_logs_pending_idx
  ON public.monday_sync_logs (status, next_attempt_at);