
CREATE TYPE public.app_role AS ENUM ('admin','approver','payment_manager','accounting','viewer');
CREATE TYPE public.payment_status AS ENUM ('draft','submitted','awaiting_approval','approved','rejected','awaiting_payment','paid','awaiting_invoice','completed','cancelled');
CREATE TYPE public.payment_method AS ENUM ('paypal','bank_transfer');
CREATE TYPE public.invoice_status AS ENUM ('attached','pending','received');
CREATE TYPE public.vendor_link_purpose AS ENUM ('payment_request','invoice_upload');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.payment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_categories TO authenticated;
GRANT ALL ON public.payment_categories TO service_role;
ALTER TABLE public.payment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select_staff" ON public.payment_categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "categories_admin_write" ON public.payment_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "currencies_select_staff" ON public.currencies FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "currencies_admin_write" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_staff" ON public.app_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  contact_first_name TEXT,
  contact_last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address_line TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  registration_number TEXT,
  tax_id TEXT,
  preferred_currency TEXT,
  preferred_payment_method public.payment_method,
  internal_notes TEXT,
  payment_details_changed BOOLEAN NOT NULL DEFAULT false,
  payment_details_changed_at TIMESTAMPTZ,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vendors_email_unique ON public.vendors (lower(email));
CREATE INDEX vendors_name_idx ON public.vendors (lower(vendor_name));
GRANT SELECT ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_select_staff" ON public.vendors FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "vendors_admin_write" ON public.vendors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vendor_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  method public.payment_method NOT NULL,
  paypal_email TEXT,
  paypal_account_name TEXT,
  paypal_link TEXT,
  beneficiary_name TEXT,
  beneficiary_address TEXT,
  beneficiary_country TEXT,
  bank_name TEXT,
  bank_address TEXT,
  bank_country TEXT,
  swift_bic TEXT,
  account_number TEXT,
  iban TEXT,
  routing_number TEXT,
  sort_code TEXT,
  branch_number TEXT,
  clabe TEXT,
  bsb TEXT,
  transit_number TEXT,
  local_clearing_code TEXT,
  intermediary_bank TEXT,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pending_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vendor_bank_accounts_vendor_idx ON public.vendor_bank_accounts (vendor_id);
GRANT SELECT ON public.vendor_bank_accounts TO authenticated;
GRANT ALL ON public.vendor_bank_accounts TO service_role;
ALTER TABLE public.vendor_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_select_privileged" ON public.vendor_bank_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'payment_manager'));
CREATE POLICY "bank_admin_write" ON public.vendor_bank_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER vendor_bank_updated_at BEFORE UPDATE ON public.vendor_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vendor_detail_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_masked TEXT,
  new_masked TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.vendor_detail_changes TO authenticated;
GRANT ALL ON public.vendor_detail_changes TO service_role;
ALTER TABLE public.vendor_detail_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vdc_select_privileged" ON public.vendor_detail_changes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'payment_manager'));
CREATE POLICY "vdc_admin_write" ON public.vendor_detail_changes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE SEQUENCE public.payment_request_seq START 1;

CREATE OR REPLACE FUNCTION public.next_payment_request_number()
RETURNS TEXT LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'PAY-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.payment_request_seq')::text, 6, '0');
$$;

CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE DEFAULT public.next_payment_request_number(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  status public.payment_status NOT NULL DEFAULT 'draft',
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  invoice_number TEXT,
  po_reference TEXT,
  due_date DATE,
  notes TEXT,
  payment_method public.payment_method NOT NULL,
  invoice_status public.invoice_status NOT NULL DEFAULT 'pending',
  vendor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  possible_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_at TIMESTAMPTZ,
  reminders_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_requests_vendor_idx ON public.payment_requests (vendor_id);
CREATE INDEX payment_requests_status_idx ON public.payment_requests (status);
CREATE INDEX payment_requests_due_idx ON public.payment_requests (due_date);
GRANT SELECT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_select_staff" ON public.payment_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "requests_admin_write" ON public.payment_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payment_requests_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INT NOT NULL,
  uploaded_by UUID,
  uploaded_by_vendor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_documents_request_idx ON public.payment_documents (payment_request_id);
GRANT SELECT ON public.payment_documents TO authenticated;
GRANT ALL ON public.payment_documents TO service_role;
ALTER TABLE public.payment_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select_staff" ON public.payment_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "documents_admin_write" ON public.payment_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payment_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  reason TEXT,
  notes TEXT,
  decided_by UUID NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_approvals TO authenticated;
GRANT ALL ON public.payment_approvals TO service_role;
ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_select_staff" ON public.payment_approvals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "approvals_insert_approver" ON public.payment_approvals FOR INSERT TO authenticated
  WITH CHECK (decided_by = auth.uid() AND (public.has_role(auth.uid(),'approver') OR public.has_role(auth.uid(),'admin')));

CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  paid_on DATE NOT NULL,
  amount_paid NUMERIC(18,2) NOT NULL,
  currency_paid TEXT NOT NULL,
  reference TEXT NOT NULL,
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select_staff" ON public.payment_transactions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "transactions_insert_manager" ON public.payment_transactions FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid() AND (public.has_role(auth.uid(),'payment_manager') OR public.has_role(auth.uid(),'admin')));

CREATE TABLE public.payment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  previous_status public.payment_status,
  new_status public.payment_status NOT NULL,
  changed_by UUID,
  actor_label TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX status_history_request_idx ON public.payment_status_history (payment_request_id);
GRANT SELECT ON public.payment_status_history TO authenticated;
GRANT ALL ON public.payment_status_history TO service_role;
ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_history_select_staff" ON public.payment_status_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.payment_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_comments TO authenticated;
GRANT ALL ON public.payment_comments TO service_role;
ALTER TABLE public.payment_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_staff" ON public.payment_comments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "comments_insert_staff" ON public.payment_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_staff(auth.uid()));

CREATE TABLE public.invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence_number INT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
);
CREATE INDEX invoice_reminders_request_idx ON public.invoice_reminders (payment_request_id);
GRANT SELECT ON public.invoice_reminders TO authenticated;
GRANT ALL ON public.invoice_reminders TO service_role;
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_select_staff" ON public.invoice_reminders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_staff" ON public.notifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_log_select_staff" ON public.email_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.monday_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  monday_item_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.monday_sync_logs TO authenticated;
GRANT ALL ON public.monday_sync_logs TO service_role;
ALTER TABLE public.monday_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monday_select_staff" ON public.monday_sync_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_label TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  payment_request_id UUID,
  vendor_id UUID,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_logs_time_idx ON public.audit_logs (occurred_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_privileged" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accounting') OR public.has_role(auth.uid(),'approver'));

CREATE TABLE public.vendor_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  purpose public.vendor_link_purpose NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendor_links TO authenticated;
GRANT ALL ON public.vendor_links TO service_role;
ALTER TABLE public.vendor_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_links_select_staff" ON public.vendor_links FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.public_form_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX public_form_hits_idx ON public.public_form_hits (bucket_key, action, created_at DESC);
GRANT ALL ON public.public_form_hits TO service_role;
ALTER TABLE public.public_form_hits ENABLE ROW LEVEL SECURITY;

INSERT INTO public.payment_categories (key,label,sort_order) VALUES
 ('supplier','Supplier',1),('freelancer','Freelancer',2),('services','Services',3),
 ('marketing','Marketing',4),('operations','Operations',5),('software','Software',6),
 ('logistics','Logistics',7),('travel','Travel',8),('refund','Refund',9),('other','Other',10);

INSERT INTO public.currencies (code,name,priority) VALUES
 ('USD','US Dollar',100),('EUR','Euro',90),('MXN','Mexican Peso',80),('ILS','Israeli Shekel',70),
 ('GBP','British Pound',0),('CAD','Canadian Dollar',0),('AUD','Australian Dollar',0),('CHF','Swiss Franc',0),
 ('JPY','Japanese Yen',0),('CNY','Chinese Yuan',0),('HKD','Hong Kong Dollar',0),('SGD','Singapore Dollar',0),
 ('SEK','Swedish Krona',0),('NOK','Norwegian Krone',0),('DKK','Danish Krone',0),('PLN','Polish Zloty',0),
 ('CZK','Czech Koruna',0),('HUF','Hungarian Forint',0),('RON','Romanian Leu',0),('TRY','Turkish Lira',0),
 ('INR','Indian Rupee',0),('BRL','Brazilian Real',0),('ARS','Argentine Peso',0),('CLP','Chilean Peso',0),
 ('COP','Colombian Peso',0),('ZAR','South African Rand',0),('AED','UAE Dirham',0),('SAR','Saudi Riyal',0),
 ('NZD','New Zealand Dollar',0),('KRW','South Korean Won',0),('THB','Thai Baht',0),('PHP','Philippine Peso',0),
 ('IDR','Indonesian Rupiah',0),('MYR','Malaysian Ringgit',0),('VND','Vietnamese Dong',0),('UAH','Ukrainian Hryvnia',0);

INSERT INTO public.app_settings (key,value) VALUES
 ('approver_email','"Info@ed-b.co.il"'::jsonb),
 ('payment_manager_email','"kim@ziporra.com"'::jsonb),
 ('accounting_email','"bill@nanoclear.com"'::jsonb),
 ('reminder_policy','{"daily_until_day":6,"twice_daily_from_day":7}'::jsonb),
 ('vendor_link_ttl_days','14'::jsonb);
