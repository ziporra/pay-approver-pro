import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPEN_STATUSES = [
  "draft",
  "submitted",
  "awaiting_approval",
  "approved",
  "awaiting_payment",
  "awaiting_invoice",
];

/**
 * Everything the supplier card needs: profile, masked payout details, linked
 * requests with their documents, totals per currency and sync state.
 */
export const getVendorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ vendorId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { missingPayoutFields } = await import("./vendor-completeness");
    const { maskTail, maskEmail } = await import("./masking");

    const { data: vendor } = await context.supabase
      .from("vendors")
      .select("*")
      .eq("id", data.vendorId)
      .maybeSingle();
    if (!vendor) throw new Error("Vendor not found.");

    const { data: bank } = await context.supabase
      .from("vendor_bank_accounts")
      .select(
        "id, method, paypal_email, beneficiary_name, bank_name, bank_country, swift_bic, iban, account_number, branch_number, pending_review, updated_at",
      )
      .eq("vendor_id", data.vendorId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: requests } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, invoice_number, due_date, invoice_status, paid_at, created_at, monday_item_id, monday_sync_status",
      )
      .eq("vendor_id", data.vendorId)
      .order("created_at", { ascending: false })
      .limit(300);

    const ids = (requests ?? []).map((r) => r.id);
    const { data: documents } = ids.length
      ? await context.supabase
          .from("payment_documents")
          .select("id, payment_request_id, doc_type, file_name, mime_type, file_size, created_at")
          .in("payment_request_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] };

    const totals: Record<string, { paid: number; outstanding: number }> = {};
    for (const r of requests ?? []) {
      const bucket = (totals[r.currency] ??= { paid: 0, outstanding: 0 });
      if (r.status === "paid" || r.status === "completed") bucket.paid += Number(r.amount);
      else if (OPEN_STATUSES.includes(r.status)) bucket.outstanding += Number(r.amount);
    }

    const missing = missingPayoutFields({
      vendor_name: vendor.vendor_name,
      beneficiary_name: bank?.beneficiary_name ?? vendor.beneficiary_name,
      country: vendor.country,
      method: bank?.method ?? vendor.preferred_payment_method,
      paypal_email: bank?.paypal_email ?? null,
      bank_name: bank?.bank_name ?? null,
      bank_country: bank?.bank_country ?? null,
      swift_bic: bank?.swift_bic ?? null,
      iban: bank?.iban ?? null,
      account_number: bank?.account_number ?? null,
    });

    return {
      vendor,
      // Banking is never returned in full — only masked identifiers.
      payout: bank
        ? {
            method: bank.method,
            paypal_email: bank.paypal_email ? maskEmail(bank.paypal_email) : null,
            beneficiary_name: bank.beneficiary_name,
            bank_name: bank.bank_name,
            bank_country: bank.bank_country,
            swift_bic: bank.swift_bic ? maskTail(bank.swift_bic, 3) : null,
            iban: maskTail(bank.iban),
            account_number: maskTail(bank.account_number),
            pending_review: bank.pending_review,
            updated_at: bank.updated_at,
          }
        : null,
      missing,
      payoutReady: missing.length === 0,
      requests: requests ?? [],
      documents: documents ?? [],
      totals,
    };
  });

/** Attach a document (receipt, proof of payment, invoice) to a request. */
export const uploadRequestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        fileName: z.string().min(1).max(300),
        dataUrl: z.string().min(32).max(24_000_000),
        docType: z.enum(["invoice", "proforma", "receipt", "proof_of_payment"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireRoles } = await import("./access.server");
    await requireRoles(context.supabase, context.userId, [
      "admin",
      "approver",
      "payment_manager",
      "accounting",
    ]);
    const { decodeUpload } = await import("./vendor-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bytes, mime } = decodeUpload(data.dataUrl);

    const { data: request } = await supabaseAdmin
      .from("payment_requests")
      .select("id, vendor_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request) throw new Error("Payment request not found.");

    const ext = mime === "application/pdf" ? "pdf" : (mime.split("/")[1] ?? "bin");
    const path = `${request.vendor_id ?? "internal"}/${request.id}/${data.docType}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("payment-documents")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error("The document could not be stored.");

    await supabaseAdmin.from("payment_documents").insert({
      payment_request_id: request.id,
      doc_type: data.docType,
      storage_path: path,
      file_name: data.fileName.slice(0, 200),
      mime_type: mime,
      file_size: bytes.byteLength,
      uploaded_by: context.userId,
      uploaded_by_vendor: false,
    });

    await context.supabase.rpc("write_audit", {
      _action: "document_uploaded",
      _payment_request_id: request.id,
      _metadata: { doc_type: data.docType, file_name: data.fileName.slice(0, 200) },
    });

    return { ok: true };
  });

/** Warn before creating a request that already exists for this invoice. */
export const checkDuplicateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        vendorId: z.string().uuid().nullable().optional(),
        invoiceNumber: z.string().max(120).nullable().optional(),
        amount: z.number().nullable().optional(),
        currency: z.string().max(3).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!data.invoiceNumber && !(data.vendorId && data.amount)) return { duplicates: [] };
    let query = context.supabase
      .from("payment_requests")
      .select("id, request_number, amount, currency, status, invoice_number, created_at")
      .limit(5);
    if (data.vendorId) query = query.eq("vendor_id", data.vendorId);
    if (data.invoiceNumber) query = query.ilike("invoice_number", data.invoiceNumber.trim());
    else if (data.amount && data.currency)
      query = query.eq("amount", data.amount).eq("currency", data.currency);
    const { data: rows } = await query;
    return { duplicates: rows ?? [] };
  });

/** Save supplier details only (no payment request) — used by the AI intake. */
export const saveVendorDetailsOnly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        vendor_name: z.string().min(2).max(200),
        beneficiary_name: z.string().max(200).nullable().optional(),
        email: z.string().max(200).nullable().optional(),
        country: z.string().max(120).nullable().optional(),
        city: z.string().max(120).nullable().optional(),
        tax_id: z.string().max(80).nullable().optional(),
        registration_number: z.string().max(80).nullable().optional(),
        preferred_currency: z.string().max(8).nullable().optional(),
        category: z.string().max(80).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireRoles } = await import("./access.server");
    await requireRoles(context.supabase, context.userId, [
      "admin",
      "approver",
      "payment_manager",
      "accounting",
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trim = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

    // Bank details are deliberately NOT part of this payload: an invoice can
    // never overwrite stored payout details.
    const fields = {
      vendor_name: data.vendor_name.trim(),
      beneficiary_name: trim(data.beneficiary_name),
      email: trim(data.email)?.toLowerCase() ?? null,
      country: trim(data.country),
      city: trim(data.city),
      tax_id: trim(data.tax_id),
      registration_number: trim(data.registration_number),
      preferred_currency: trim(data.preferred_currency),
      category: trim(data.category),
    };

    if (data.id) {
      const { data: existing } = await supabaseAdmin
        .from("vendors")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing) throw new Error("Vendor not found.");
      // Only fill blanks; a richer stored value always wins.
      const patch: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(fields)) {
        const current = (existing as Record<string, unknown>)[key];
        if (value && (current === null || current === undefined || String(current).trim() === "")) {
          patch[key] = value;
        }
      }
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("vendors").update(patch as never).eq("id", data.id);
      }
      await context.supabase.rpc("write_audit", {
        _action: "vendor_updated",
        _vendor_id: data.id,
        _metadata: { source: "invoice_ai", fields: Object.keys(patch) },
      });
      return { id: data.id, filled: Object.keys(patch) };
    }

    const { data: created, error } = await supabaseAdmin
      .from("vendors")
      .insert({ ...fields, import_source: "invoice_ai" })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save the supplier.");
    await context.supabase.rpc("write_audit", {
      _action: "vendor_created",
      _vendor_id: created.id,
      _metadata: { source: "invoice_ai" },
    });
    return { id: created.id, filled: Object.keys(fields) };
  });
