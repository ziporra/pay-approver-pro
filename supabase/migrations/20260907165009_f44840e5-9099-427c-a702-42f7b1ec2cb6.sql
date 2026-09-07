-- 1. Partial vendor save: only the vendor name stays mandatory
ALTER TABLE public.vendors ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.vendors ALTER COLUMN beneficiary_name DROP NOT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payout_ready boolean NOT NULL DEFAULT false;

-- 2. Expense types
DO $$ BEGIN
  CREATE TYPE public.expense_type AS ENUM ('supplier','salary','pension','tax_deduction','subscription','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Employees (payroll-sensitive directory)
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  employee_number text,
  email text,
  phone text,
  country text,
  department text,
  job_title text,
  start_date date,
  end_date date,
  default_currency text,
  payment_method public.payment_method,
  bank_name text,
  bank_country text,
  swift_bic text,
  iban text,
  account_number text,
  branch_number text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_name_idx ON public.employees (lower(full_name));

CREATE OR REPLACE FUNCTION public.can_view_payroll(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','accounting','payment_manager')
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_payroll(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_payroll(uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select_payroll" ON public.employees FOR SELECT TO authenticated
  USING (public.can_view_payroll(auth.uid()));
CREATE POLICY "employees_write_payroll" ON public.employees FOR ALL TO authenticated
  USING (public.can_view_payroll(auth.uid())) WITH CHECK (public.can_view_payroll(auth.uid()));
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Expense fields on payment requests
ALTER TABLE public.payment_requests
  ALTER COLUMN vendor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS expense_type public.expense_type NOT NULL DEFAULT 'supplier',
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS accounting_month date,
  ADD COLUMN IF NOT EXISTS recipient_kind text NOT NULL DEFAULT 'vendor',
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_id uuid;

UPDATE public.payment_requests SET accounting_month = date_trunc('month', coalesce(due_date::timestamptz, created_at))::date
  WHERE accounting_month IS NULL;
ALTER TABLE public.payment_requests ALTER COLUMN accounting_month SET DEFAULT date_trunc('month', now())::date;

ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_party_check
  CHECK (vendor_id IS NOT NULL OR employee_id IS NOT NULL OR recipient_name IS NOT NULL);
ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_month_first_day CHECK (accounting_month IS NULL OR extract(day from accounting_month) = 1);

CREATE OR REPLACE FUNCTION public.set_request_sensitivity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_sensitive := NEW.expense_type IN ('salary','pension','tax_deduction') OR NEW.employee_id IS NOT NULL;
  IF NEW.accounting_month IS NOT NULL THEN
    NEW.accounting_month := date_trunc('month', NEW.accounting_month)::date;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS payment_requests_sensitivity ON public.payment_requests;
CREATE TRIGGER payment_requests_sensitivity BEFORE INSERT OR UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_request_sensitivity();

UPDATE public.payment_requests SET is_sensitive = is_sensitive;

CREATE INDEX IF NOT EXISTS payment_requests_month_idx ON public.payment_requests (accounting_month);
CREATE INDEX IF NOT EXISTS payment_requests_expense_type_idx ON public.payment_requests (expense_type);

-- Sensitive payroll rows are only visible to payroll-cleared staff
DROP POLICY IF EXISTS "requests_select_staff" ON public.payment_requests;
CREATE POLICY "requests_select_staff" ON public.payment_requests FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND (NOT is_sensitive OR public.can_view_payroll(auth.uid())));

DROP POLICY IF EXISTS "documents_select_staff" ON public.payment_documents;
CREATE POLICY "documents_select_staff" ON public.payment_documents FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.payment_requests pr
      WHERE pr.id = payment_documents.payment_request_id
        AND pr.is_sensitive
        AND NOT public.can_view_payroll(auth.uid())
    )
  );

-- 5. Recurring templates -> drafts only, idempotent per month
CREATE TABLE IF NOT EXISTS public.recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  expense_type public.expense_type NOT NULL DEFAULT 'supplier',
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
  recipient_name text,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  category text,
  description text NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  due_day smallint NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 28),
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_templates TO authenticated;
GRANT ALL ON public.recurring_templates TO service_role;
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_select_staff" ON public.recurring_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid())
    AND (expense_type NOT IN ('salary','pension','tax_deduction') AND employee_id IS NULL
         OR public.can_view_payroll(auth.uid())));
CREATE POLICY "templates_write_admin" ON public.recurring_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER recurring_templates_updated_at BEFORE UPDATE ON public.recurring_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_template_fk FOREIGN KEY (template_id)
  REFERENCES public.recurring_templates(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_template_month_unique
  ON public.payment_requests (template_id, accounting_month) WHERE template_id IS NOT NULL;