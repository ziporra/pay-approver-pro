import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.object({ email: z.string().email().max(200) });
const nameSchema = z.object({ query: z.string().min(3).max(80) });

const vendorInput = z.object({
  vendor_name: z.string().min(2).max(200),
  beneficiary_name: z.string().min(2).max(200),
  contact_first_name: z.string().max(100).optional().nullable(),
  contact_last_name: z.string().max(100).optional().nullable(),
  email: z.string().email().max(200),
  phone: z.string().max(60).optional().nullable(),
  address_line: z.string().max(300).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state_province: z.string().max(120).optional().nullable(),
  postal_code: z.string().max(40).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  registration_number: z.string().max(80).optional().nullable(),
  tax_id: z.string().max(80).optional().nullable(),
});

const paymentDetailsInput = z.object({
  method: z.enum(["paypal", "bank_transfer"]),
  paypal_email: z.string().max(200).optional().nullable(),
  paypal_account_name: z.string().max(200).optional().nullable(),
  paypal_link: z.string().max(300).optional().nullable(),
  beneficiary_name: z.string().max(200).optional().nullable(),
  beneficiary_address: z.string().max(300).optional().nullable(),
  beneficiary_country: z.string().max(120).optional().nullable(),
  bank_name: z.string().max(200).optional().nullable(),
  bank_address: z.string().max(300).optional().nullable(),
  bank_country: z.string().max(120).optional().nullable(),
  swift_bic: z.string().max(40).optional().nullable(),
  account_number: z.string().max(60).optional().nullable(),
  iban: z.string().max(60).optional().nullable(),
  routing_number: z.string().max(40).optional().nullable(),
  sort_code: z.string().max(40).optional().nullable(),
  branch_number: z.string().max(40).optional().nullable(),
  clabe: z.string().max(40).optional().nullable(),
  bsb: z.string().max(40).optional().nullable(),
  transit_number: z.string().max(40).optional().nullable(),
  local_clearing_code: z.string().max(40).optional().nullable(),
  intermediary_bank: z.string().max(300).optional().nullable(),
  instructions: z.string().max(1000).optional().nullable(),
});

const submitSchema = z.object({
  vendorId: z.string().uuid().nullable(),
  vendor: vendorInput,
  payment: paymentDetailsInput,
  request: z.object({
    amount: z.number().positive().max(1_000_000_000),
    currency: z.string().length(3),
    description: z.string().min(3).max(1000),
    category: z.string().max(60).optional().nullable(),
    invoice_number: z.string().max(80).optional().nullable(),
    po_reference: z.string().max(80).optional().nullable(),
    due_date: z.string().max(20).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    invoice_attached: z.boolean(),
  }),
  document: z.object({
    fileName: z.string().min(1).max(200),
    dataUrl: z.string().min(16).max(22_000_000),
    docType: z.enum(["invoice", "proforma"]),
  }),
});

/** Find an existing vendor by exact email. Returns masked data only. */
export const lookupVendorByEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const { getAdmin, enforceRateLimit, hashKey, toMaskedVendor } = await import(
      "./vendor-portal.server"
    );
    const admin = await getAdmin();
    await enforceRateLimit(admin, hashKey(data.email), "lookup", 12, 300);

    const { data: vendor } = await admin
      .from("vendors")
      .select(
        "id, vendor_name, beneficiary_name, contact_first_name, contact_last_name, email, phone, city, country, preferred_currency, preferred_payment_method",
      )
      .ilike("email", data.email)
      .maybeSingle();
    if (!vendor) return { found: false as const };

    const { data: bank } = await admin
      .from("vendor_bank_accounts")
      .select("method, paypal_email, iban, account_number, bank_name")
      .eq("vendor_id", vendor.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { found: true as const, vendor: toMaskedVendor(vendor, bank ?? null) };
  });

/** Narrow autocomplete: minimum 3 characters, at most 5 minimal matches. */
export const searchVendorsByName = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => nameSchema.parse(data))
  .handler(async ({ data }) => {
    const { getAdmin, enforceRateLimit, hashKey } = await import("./vendor-portal.server");
    const admin = await getAdmin();
    await enforceRateLimit(admin, hashKey(data.query), "search", 20, 300);

    const term = `%${data.query.replace(/[%_]/g, "")}%`;
    const { data: rows } = await admin
      .from("vendors")
      .select("id, vendor_name, city, country")
      .or(`vendor_name.ilike.${term},beneficiary_name.ilike.${term}`)
      .limit(5);

    return {
      matches: (rows ?? []).map((r) => ({
        id: r.id,
        vendorName: r.vendor_name,
        location: [r.city, r.country].filter(Boolean).join(", "),
      })),
    };
  });

/** Suggest an existing vendor before a duplicate record is created. */
export const findPossibleVendorDuplicates = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().max(200).optional().nullable(),
        vendor_name: z.string().max(200).optional().nullable(),
        beneficiary_name: z.string().max(200).optional().nullable(),
        phone: z.string().max(60).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getAdmin, enforceRateLimit, hashKey } = await import("./vendor-portal.server");
    const admin = await getAdmin();
    await enforceRateLimit(admin, hashKey(data.email ?? data.vendor_name ?? "anon"), "dupe", 20, 300);

    const filters: string[] = [];
    const esc = (v: string) => v.replace(/[%_,()]/g, "");
    if (data.email) filters.push(`email.ilike.${esc(data.email)}`);
    if (data.vendor_name && data.vendor_name.length >= 3)
      filters.push(`vendor_name.ilike.%${esc(data.vendor_name)}%`);
    if (data.beneficiary_name && data.beneficiary_name.length >= 3)
      filters.push(`beneficiary_name.ilike.%${esc(data.beneficiary_name)}%`);
    if (data.phone && data.phone.length >= 6) filters.push(`phone.ilike.%${esc(data.phone)}%`);
    if (filters.length === 0) return { matches: [] };

    const { data: rows } = await admin
      .from("vendors")
      .select("id, vendor_name, city, country")
      .or(filters.join(","))
      .limit(3);

    return {
      matches: (rows ?? []).map((r) => ({
        id: r.id,
        vendorName: r.vendor_name,
        location: [r.city, r.country].filter(Boolean).join(", "),
      })),
    };
  });

/** Submit a payment request from the public vendor wizard. */
export const submitPaymentRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { getAdmin, enforceRateLimit, hashKey, decodeUpload, diffSensitive, nullify } = await import(
      "./vendor-portal.server"
    );
    const { missingVendorFields } = await import("./vendor-completeness");
    const admin = await getAdmin();
    await enforceRateLimit(admin, hashKey(data.vendor.email), "submit", 6, 3600);

    // Vendor profile must be complete (base details + payment details) before a request exists.
    const missing = missingVendorFields({ ...data.vendor, ...data.payment });
    if (missing.length > 0) {
      throw new Error(`The vendor profile is incomplete: ${missing.join(", ")}`);
    }

    const { bytes, mime } = decodeUpload(data.document.dataUrl);


    // 1. Resolve or create the vendor master record.
    let vendorId = data.vendorId;
    const vendorFields = nullify({
      ...data.vendor,
      preferred_currency: data.request.currency,
      preferred_payment_method: data.payment.method,
    });
    if (vendorId) {
      await admin.from("vendors").update(vendorFields).eq("id", vendorId);
    } else {
      const { data: existing } = await admin
        .from("vendors")
        .select("id")
        .ilike("email", data.vendor.email)
        .maybeSingle();
      if (existing) {
        vendorId = existing.id;
        await admin.from("vendors").update(vendorFields).eq("id", vendorId);
      } else {
        const { data: created, error } = await admin
          .from("vendors")
          .insert(vendorFields)
          .select("id")
          .single();
        if (error) throw new Error("Could not save the vendor profile.");
        vendorId = created.id;
      }
    }

    // 2. Store payment details, flagging sensitive changes for internal review.
    const { data: previousBank } = await admin
      .from("vendor_bank_accounts")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const changes = diffSensitive(previousBank ?? null, data.payment);
    if (previousBank) {
      await admin.from("vendor_bank_accounts").update({ is_active: false }).eq("id", previousBank.id);
    }
    await admin.from("vendor_bank_accounts").insert(
      nullify({
        ...data.payment,
        vendor_id: vendorId!,
        is_active: true,
        pending_review: changes.length > 0,
      }),
    );
    if (changes.length > 0) {
      await admin
        .from("vendor_detail_changes")
        .insert(changes.map((c) => ({ ...c, vendor_id: vendorId! })));
      await admin
        .from("vendors")
        .update({ payment_details_changed: true, payment_details_changed_at: new Date().toISOString() })
        .eq("id", vendorId);
      await admin.from("audit_logs").insert({
        action: "vendor_payment_details_changed",
        vendor_id: vendorId,
        actor_label: data.vendor.email,
        actor_role: "vendor",
        metadata: { fields: changes.map((c) => c.field) },
      });
    }

    // 3. Duplicate payment detection (same vendor, amount, currency, invoice,近 date).
    const sinceDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let duplicateQuery = admin
      .from("payment_requests")
      .select("id")
      .eq("vendor_id", vendorId)
      .eq("amount", data.request.amount)
      .eq("currency", data.request.currency)
      .gte("created_at", sinceDate)
      .limit(1);
    if (data.request.invoice_number) {
      duplicateQuery = duplicateQuery.eq("invoice_number", data.request.invoice_number);
    }
    const { data: duplicates } = await duplicateQuery;
    const duplicateOf = duplicates?.[0]?.id ?? null;

    // 4. Create the request with an immutable snapshot of vendor + payment data.
    const paymentSnapshot = { ...data.payment };
    const { data: request, error: requestError } = await admin
      .from("payment_requests")
      .insert({
        vendor_id: vendorId!,
        status: "awaiting_approval",
        amount: data.request.amount,
        currency: data.request.currency,
        description: data.request.description,
        category: data.request.category ?? null,
        invoice_number: data.request.invoice_number ?? null,
        po_reference: data.request.po_reference ?? null,
        due_date: data.request.due_date || null,
        notes: data.request.notes ?? null,
        payment_method: data.payment.method,
        invoice_status: data.request.invoice_attached ? "attached" : "pending",
        vendor_snapshot: data.vendor,
        payment_snapshot: paymentSnapshot,
        possible_duplicate: Boolean(duplicateOf),
        duplicate_of: duplicateOf,
        submitted_at: new Date().toISOString(),
      })
      .select("id, request_number")
      .single();
    if (requestError || !request) throw new Error("Could not create the payment request.");

    // 5. Store the supporting document in the private bucket.
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
    const path = `${vendorId}/${request.id}/${data.document.docType}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("payment-documents")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (!uploadError) {
      await admin.from("payment_documents").insert({
        payment_request_id: request.id,
        doc_type: data.document.docType,
        storage_path: path,
        file_name: data.document.fileName.slice(0, 200),
        mime_type: mime,
        file_size: bytes.byteLength,
        uploaded_by_vendor: true,
      });
    }

    // 6. Workflow bookkeeping: history, audit trail, notification queue.
    await admin.from("payment_status_history").insert({
      payment_request_id: request.id,
      previous_status: "draft",
      new_status: "awaiting_approval",
      actor_label: data.vendor.email,
      note: "Submitted through the vendor portal",
    });
    await admin.from("audit_logs").insert({
      action: "payment_request_created",
      payment_request_id: request.id,
      vendor_id: vendorId,
      actor_label: data.vendor.email,
      actor_role: "vendor",
      previous_status: "draft",
      new_status: "awaiting_approval",
      metadata: {
        amount: data.request.amount,
        currency: data.request.currency,
        possible_duplicate: Boolean(duplicateOf),
      },
    });
    await admin.from("notifications").insert({
      event: "payment_submitted",
      payment_request_id: request.id,
      payload: {
        request_number: request.request_number,
        vendor: data.vendor.vendor_name,
        amount: data.request.amount,
        currency: data.request.currency,
        due_date: data.request.due_date ?? null,
      },
    });
    // 7. Mirror to Monday.com. Never blocks or fails the submission: the
    //    dispatcher records every attempt and retries later if Monday is down.
    const { dispatchMondaySync } = await import("./monday.server");
    await dispatchMondaySync(admin, { action: "sync_vendor", vendorId });
    await dispatchMondaySync(admin, {
      action: "create_item",
      paymentRequestId: request.id,
      vendorId,
    });
    if (data.request.invoice_attached) {
      await dispatchMondaySync(admin, {
        action: "upload_invoice",
        paymentRequestId: request.id,
        vendorId,
      });
    }

    return {
      requestNumber: request.request_number,
      possibleDuplicate: Boolean(duplicateOf),
    };
  });
