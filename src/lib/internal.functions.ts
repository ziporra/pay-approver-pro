import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Roles for the signed-in user, used to shape the internal UI. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      roles: (data ?? []).map((r) => r.role as string),
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
    };
  });

/** Payment requests visible to the signed-in staff member. */
export const listPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, invoice_number, due_date, invoice_status, possible_duplicate, created_at, paid_at, vendors(vendor_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { rows: [], error: error.message };
    return { rows: data ?? [], error: null };
  });

/** Vendor directory for internal users. */
export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vendors")
      .select(
        "id, vendor_name, beneficiary_name, email, city, country, preferred_currency, preferred_payment_method, payment_details_changed, is_favorite, created_at",
      )
      .order("vendor_name")
      .limit(500);
    if (error) return { rows: [], error: error.message };
    return { rows: data ?? [], error: null };
  });

/** Vendor card: profile, ledger totals per currency and payment history. */
export const getVendorLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ vendorId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: vendor } = await context.supabase
      .from("vendors")
      .select("*")
      .eq("id", data.vendorId)
      .maybeSingle();
    if (!vendor) throw new Error("Vendor not found");

    const { data: requests } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, due_date, invoice_status, paid_at, created_at",
      )
      .eq("vendor_id", data.vendorId)
      .order("created_at", { ascending: false });

    const { data: changes } = await context.supabase
      .from("vendor_detail_changes")
      .select("id, field, old_masked, new_masked, reviewed, created_at")
      .eq("vendor_id", data.vendorId)
      .order("created_at", { ascending: false })
      .limit(10);

    return { vendor, requests: requests ?? [], changes: changes ?? [] };
  });

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "reject", "mark_paid", "invoice_received", "cancel"]),
  note: z.string().max(1000).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
});

type PaymentStatus =
  Database["public"]["Tables"]["payment_requests"]["Row"]["status"];
type RequestUpdate = Database["public"]["Tables"]["payment_requests"]["Update"];

const NEXT_STATUS: Record<string, PaymentStatus> = {
  approve: "awaiting_payment",
  reject: "rejected",
  mark_paid: "paid",
  invoice_received: "completed",
  cancel: "cancelled",
};

/** Move a payment request through the workflow and record who did it. */
export const decidePaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => decisionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: current, error: readError } = await context.supabase
      .from("payment_requests")
      .select("id, status, invoice_status, request_number, amount, currency")
      .eq("id", data.requestId)
      .maybeSingle();
    if (readError || !current) throw new Error("Payment request not found.");

    if (data.action === "reject" && !data.note?.trim()) {
      throw new Error("A reason is required when rejecting a request.");
    }

    let nextStatus = NEXT_STATUS[data.action]!;
    if (data.action === "mark_paid" && current.invoice_status !== "attached") {
      nextStatus = "awaiting_invoice";
    }

    const patch: RequestUpdate = { status: nextStatus };
    if (data.action === "approve") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = context.userId;
    }
    if (data.action === "reject") {
      patch.rejected_at = new Date().toISOString();
      patch.rejection_reason = data.note ?? null;
    }
    if (data.action === "mark_paid") {
      patch.paid_at = new Date().toISOString();
    }
    if (data.action === "invoice_received") {
      patch.invoice_status = "attached";
    }

    const { error: updateError } = await context.supabase
      .from("payment_requests")
      .update(patch)
      .eq("id", data.requestId);
    if (updateError) throw new Error(updateError.message);

    if (data.action === "mark_paid") {
      await context.supabase.from("payment_transactions").insert({
        payment_request_id: data.requestId,
        amount_paid: current.amount,
        currency_paid: current.currency,
        paid_on: new Date().toISOString().slice(0, 10),
        recorded_by: context.userId,
        reference: data.reference?.trim() || current.request_number,
        notes: data.note ?? null,
      });
    }

    await context.supabase.from("payment_status_history").insert({
      payment_request_id: data.requestId,
      previous_status: current.status,
      new_status: nextStatus,
      changed_by: context.userId,
      note: data.note ?? null,
    });

    // Identity-linked, append-only audit entry for the activity timeline.
    await context.supabase.rpc("write_audit", {
      _action: data.action,
      _payment_request_id: data.requestId,
      _previous_status: current.status,
      _new_status: nextStatus,
      _metadata: { note: data.note ?? null, reference: data.reference ?? null },
    });

    if (data.action === "approve" || data.action === "reject") {
      await context.supabase.from("payment_approvals").insert({
        payment_request_id: data.requestId,
        decided_by: context.userId,
        decision: data.action === "approve" ? "approved" : "rejected",
        reason: data.note ?? null,
      });
    }

    return { status: nextStatus, requestNumber: current.request_number };
  });

/** Full payment request record for the detail view. */
export const getPaymentRequestDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: request } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, invoice_number, po_reference, due_date, notes, payment_method, invoice_status, possible_duplicate, created_at, submitted_at, approved_at, rejected_at, rejection_reason, paid_at, vendor_id, vendors(vendor_name, email, country)",
      )
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request) throw new Error("Payment request not found.");

    const { data: documents } = await context.supabase
      .from("payment_documents")
      .select("id, doc_type, file_name, mime_type, file_size, created_at")
      .eq("payment_request_id", data.requestId)
      .order("created_at", { ascending: false });

    return { request, documents: documents ?? [] };
  });
