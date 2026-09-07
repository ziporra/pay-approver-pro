import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CURRENCIES } from "./reference";
import { EXPENSE_TYPES, isSensitiveExpense, monthKey, templateDueDate } from "./expenses";

const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/)
  .transform((v) => monthKey(v.length === 7 ? `${v}-01` : v));

const expenseTypeEnum = z.enum(EXPENSE_TYPES);

const filterSchema = z.object({
  month: monthString.optional().nullable(),
  expense_type: expenseTypeEnum.optional().nullable(),
  status: z
    .enum([
      "draft",
      "submitted",
      "awaiting_approval",
      "approved",
      "rejected",
      "awaiting_payment",
      "paid",
      "awaiting_invoice",
      "completed",
      "cancelled",
    ])
    .optional()
    .nullable(),
  country: z.string().max(120).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  entity: z.string().max(200).optional().nullable(),
});

/** Monthly expense overview. Payroll rows are filtered out by row-level rules. */
export const listMonthlyExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, expense_type, accounting_month, due_date, paid_at, is_sensitive, recipient_name, vendor_id, employee_id, vendors(vendor_name, country), employees(full_name, country)",
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1000);

    if (data.month) query = query.eq("accounting_month", data.month);
    if (data.expense_type) query = query.eq("expense_type", data.expense_type);
    if (data.status) query = query.eq("status", data.status);
    if (data.category) query = query.eq("category", data.category);

    const { data: rows, error } = await query;
    if (error) return { rows: [], totals: [], error: error.message };

    const entity = (data.entity ?? "").trim().toLowerCase();
    const country = (data.country ?? "").trim().toLowerCase();
    const filtered = (rows ?? []).filter((r) => {
      const name = r.vendors?.vendor_name ?? r.employees?.full_name ?? r.recipient_name ?? "";
      const rowCountry = r.vendors?.country ?? r.employees?.country ?? "";
      if (entity && !name.toLowerCase().includes(entity)) return false;
      if (country && rowCountry.toLowerCase() !== country) return false;
      return true;
    });

    const { totalsByCurrency } = await import("./expenses");
    return {
      rows: filtered.map((r) => ({
        ...r,
        entity_name: r.vendors?.vendor_name ?? r.employees?.full_name ?? r.recipient_name ?? "—",
        entity_country: r.vendors?.country ?? r.employees?.country ?? null,
      })),
      totals: totalsByCurrency(filtered),
      error: null,
    };
  });

const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

/** Currency must be chosen explicitly; blank or unknown codes are rejected. */
const currencySchema = z
  .string()
  .trim()
  .min(1, "Currency is required")
  .transform((v) => v.toUpperCase())
  .refine((v) => CURRENCY_CODES.has(v), "Unsupported currency");

const expenseSchema = z.object({
  expense_type: expenseTypeEnum,
  vendor_id: z.string().uuid().optional().nullable(),
  employee_id: z.string().uuid().optional().nullable(),
  recipient_name: z.string().max(200).optional().nullable(),
  amount: z.number().positive().max(1_000_000_000),
  currency: currencySchema,
  description: z.string().min(2).max(1000),
  category: z.string().max(80).optional().nullable(),
  accounting_month: monthString,
  due_date: z.string().max(20).optional().nullable(),
  payment_method: z.enum(["paypal", "bank_transfer"]).default("bank_transfer"),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "awaiting_approval"]).default("draft"),
});

/** Record a single expense (supplier, payroll-type or other recipient). */
export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => expenseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireRoles, requirePayrollAccess } = await import("./access.server");
    await requireRoles(context.supabase, context.userId, [
      "admin",
      "approver",
      "payment_manager",
      "accounting",
    ]);
    const sensitive = isSensitiveExpense(data.expense_type, data.employee_id);
    if (sensitive) await requirePayrollAccess(context.supabase, context.userId);

    if (!data.vendor_id && !data.employee_id && !data.recipient_name?.trim()) {
      throw new Error("Choose a vendor, an employee or type the recipient name.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin
      .from("payment_requests")
      .insert({
        expense_type: data.expense_type,
        vendor_id: data.vendor_id ?? null,
        employee_id: data.employee_id ?? null,
        recipient_name: data.recipient_name?.trim() || null,
        recipient_kind: data.employee_id ? "employee" : data.vendor_id ? "vendor" : "other",
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        category: data.category ?? null,
        accounting_month: data.accounting_month,
        due_date: data.due_date || null,
        payment_method: data.payment_method,
        notes: data.notes ?? null,
        status: data.status,
        submitted_at: data.status === "awaiting_approval" ? new Date().toISOString() : null,
      })
      .select("id, request_number")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save the expense.");

    await context.supabase.rpc("write_audit", {
      _action: "expense_created",
      _payment_request_id: created.id,
      _new_status: data.status,
      _metadata: {
        expense_type: data.expense_type,
        accounting_month: data.accounting_month,
        sensitive,
      },
    });

    return { id: created.id, requestNumber: created.request_number };
  });

/** Recurring templates. Payroll templates stay hidden from non-payroll staff. */
export const listRecurringTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recurring_templates")
      .select(
        "id, name, expense_type, vendor_id, employee_id, recipient_name, amount, currency, category, description, payment_method, due_day, active, created_at, vendors(vendor_name), employees(full_name)",
      )
      .order("name")
      .limit(300);
    if (error) return { rows: [], error: error.message };
    return {
      rows: (data ?? []).map((r) => ({
        ...r,
        entity_name: r.vendors?.vendor_name ?? r.employees?.full_name ?? r.recipient_name ?? "—",
      })),
      error: null,
    };
  });

const templateSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(160),
  expense_type: expenseTypeEnum,
  vendor_id: z.string().uuid().optional().nullable(),
  employee_id: z.string().uuid().optional().nullable(),
  recipient_name: z.string().max(200).optional().nullable(),
  amount: z.number().positive().max(1_000_000_000),
  currency: currencySchema,
  category: z.string().max(80).optional().nullable(),
  description: z.string().min(2).max(1000),
  payment_method: z.enum(["paypal", "bank_transfer"]).default("bank_transfer"),
  due_day: z.number().int().min(1).max(28).default(1),
  active: z.boolean().default(true),
});

export const saveRecurringTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => templateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireRoles, requirePayrollAccess } = await import("./access.server");
    await requireRoles(context.supabase, context.userId, ["admin", "accounting", "payment_manager"]);
    if (isSensitiveExpense(data.expense_type, data.employee_id)) {
      await requirePayrollAccess(context.supabase, context.userId);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      expense_type: data.expense_type,
      vendor_id: data.vendor_id ?? null,
      employee_id: data.employee_id ?? null,
      recipient_name: data.recipient_name?.trim() || null,
      amount: data.amount,
      currency: data.currency,
      category: data.category ?? null,
      description: data.description,
      payment_method: data.payment_method,
      due_day: data.due_day,
      active: data.active,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("recurring_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("recurring_templates")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save the template.");
    return { id: created.id };
  });

/**
 * Generate one DRAFT expense per active template for a given accounting month.
 * Retry-safe: a database unique index on (template_id, accounting_month) means
 * running it twice never produces a second row. Nothing is ever paid or sent.
 */
export const generateRecurringMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ month: monthString, templateIds: z.array(z.string().uuid()).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireRoles, hasAny, getRoles, PAYROLL_ROLES } = await import("./access.server");
    await requireRoles(context.supabase, context.userId, ["admin", "accounting", "payment_manager"]);
    const roles = await getRoles(context.supabase, context.userId);
    const payroll = hasAny(roles, PAYROLL_ROLES);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("recurring_templates").select("*").eq("active", true);
    if (data.templateIds?.length) query = query.in("id", data.templateIds);
    const { data: templates, error } = await query;
    if (error) throw new Error(error.message);

    const { generateDraftsForMonth } = await import("./recurring.server");
    const { created, skipped, createdIds } = await generateDraftsForMonth(
      (templates ?? []) as never[],
      data.month,
      async (row) => {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("payment_requests")
          .insert(row as never)
          .select("id")
          .single();
        // 23505 = the draft for this template + month already exists.
        if (insertError?.code === "23505") return { conflict: true };
        if (insertError) return { error: insertError.message };
        return { id: inserted?.id };
      },
      { payrollAllowed: payroll },
    );

    await context.supabase.rpc("write_audit", {
      _action: "recurring_month_generated",
      _metadata: { month: data.month, created, skipped },
    });

    return { month: data.month, created, skipped, createdIds };
  });
