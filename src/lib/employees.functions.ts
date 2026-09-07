import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeUpdate = Database["public"]["Tables"]["employees"]["Update"];

const employeeSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(2).max(160),
  employee_number: z.string().max(60).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  job_title: z.string().max(120).optional().nullable(),
  start_date: z.string().max(20).optional().nullable(),
  end_date: z.string().max(20).optional().nullable(),
  default_currency: z.string().max(8).optional().nullable(),
  payment_method: z.enum(["paypal", "bank_transfer"]).optional().nullable(),
  bank_name: z.string().max(160).optional().nullable(),
  bank_country: z.string().max(120).optional().nullable(),
  swift_bic: z.string().max(20).optional().nullable(),
  iban: z.string().max(40).optional().nullable(),
  account_number: z.string().max(40).optional().nullable(),
  branch_number: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

type EmployeeWrite = Record<string, string | boolean | null>;

/** Drop undefined keys and turn blank strings into nulls. */
function clean(input: Record<string, unknown>): EmployeeWrite {
  const out: EmployeeWrite = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = typeof v === "string" && v.trim() === "" ? null : (v as string | boolean | null);
  }
  return out;
}

/** Employee directory. Restricted server-side to payroll-cleared roles. */
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requirePayrollAccess } = await import("./access.server");
    await requirePayrollAccess(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("employees")
      .select(
        "id, full_name, employee_number, email, country, department, job_title, default_currency, payment_method, bank_name, iban, account_number, is_active, start_date, end_date, created_at",
      )
      .order("full_name")
      .limit(500);
    if (error) return { rows: [], error: error.message };

    const { maskTail } = await import("./masking");
    return {
      rows: (data ?? []).map((e) => ({
        ...e,
        iban: undefined,
        account_number: undefined,
        masked_account: maskTail(e.iban ?? e.account_number ?? null),
        payout_ready: Boolean(
          e.payment_method === "paypal" ? e.email : e.bank_name && (e.iban || e.account_number),
        ),
      })),
      error: null,
    };
  });

/** Create or update an employee record. */
export const saveEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => employeeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requirePayrollAccess } = await import("./access.server");
    await requirePayrollAccess(context.supabase, context.userId);

    const { id, ...fields } = data;
    const payload = clean({ ...fields });

    if (id) {
      const { error } = await context.supabase.from("employees").update(payload as EmployeeUpdate).eq("id", id);
      if (error) throw new Error(error.message);
      await context.supabase.rpc("write_audit", {
        _action: "employee_updated",
        _metadata: { employee_id: id },
      });
      return { id };
    }

    const { data: created, error } = await context.supabase
      .from("employees")
      .insert({ ...(payload as EmployeeInsert), full_name: data.full_name, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.rpc("write_audit", {
      _action: "employee_created",
      _metadata: { employee_id: created.id },
    });
    return { id: created.id };
  });

/** Per-employee ledger: their expenses grouped per currency, never converted. */
export const getEmployeeLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ employeeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { requirePayrollAccess } = await import("./access.server");
    await requirePayrollAccess(context.supabase, context.userId);

    const { data: employee } = await context.supabase
      .from("employees")
      .select("id, full_name, employee_number, department, job_title, country, default_currency, is_active")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!employee) throw new Error("Employee not found.");

    const { data: rows } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, expense_type, accounting_month, due_date, paid_at, description, created_at",
      )
      .eq("employee_id", data.employeeId)
      .order("accounting_month", { ascending: false })
      .limit(400);

    const { totalsByCurrency } = await import("./expenses");
    return { employee, rows: rows ?? [], totals: totalsByCurrency(rows ?? []) };
  });
