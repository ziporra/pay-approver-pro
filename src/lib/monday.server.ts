/**
 * Monday.com integration service.
 *
 * Pay Approver Pro (Supabase) stays the source of truth; Monday is a reporting
 * and operations mirror. This module is the ONLY place that talks to Monday —
 * payment business logic never imports the Monday API directly, it just calls
 * `dispatchMondaySync`, which can never throw and never blocks a payment.
 *
 * Security: the API token lives only in the server secret store, every call is
 * server-side, and no full banking credential is ever sent — bank identifiers
 * are masked to the last four characters before leaving the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

const API_URL = "https://api.monday.com/v2";
const API_VERSION = "2024-10";

export const MONDAY = {
  paymentsBoard: "5103280906",
  contactsBoard: "1752642705",
  payments: {
    amount: "numeric_mm6rqscm",
    currency: "dropdown_mm6rpv4f",
    paymentStatus: "color_mm6rz23t",
    approval: "color_mm6r72fj",
    invoiceStatus: "color_mm6rh6ma",
    paymentMethod: "color_mm6rsemm",
    requestedDate: "date_mm6rec8g",
    owner: "multiple_person_mm6r79eg",
    approvedBy: "multiple_person_mm6rtxxb",
    description: "long_text_mm6r8376",
    invoiceNumber: "text_mm6rh65r",
    approvalDate: "date_mm6rxq2z",
    rejectionReason: "long_text_mm6rczhy",
    actualPaymentDate: "date_mm6rtpf7",
    paymentReference: "text_mm6rtbzh",
    amountPaid: "numeric_mm6r4z38",
    currencyPaid: "dropdown_mm6r6pq4",
    paidBy: "multiple_person_mm6rjjmz",
    notes: "long_text_mm6rb28h",
    duplicate: "color_mm6rt4cx",
    vendorRelation: "board_relation_mm6rh47g",
    paymentInfo: "long_text_mm6rjbwf",
    finalInvoice: "file_mm6rcegw",
    supportingDoc: "file_mm6rtv5b",
    proofOfPayment: "file_mm6rgwfd",
    appId: "text_mm6s455r",
    appLink: "link_mm6sv395",
  },
  contacts: {
    companyName: "company_name_mkkfk1sp",
    contactPerson: "contact_mkkfqeh3",
    country: "country_mkkfqfnz",
    email: "email_mkkfjdxr",
    phone: "phone_number___mkkfbq6a",
    category: "color_mm6re630",
    preferredMethod: "color_mm6rbmgq",
    preferredCurrency: "dropdown_mm6rmt8k",
    beneficiaryName: "text_mm6rf59r",
    bankName: "bank_name_mkkfmn3y",
    bankCountry: "text_mm6r3wez",
    maskedAccount: "iban__account_number__mkkfm04b",
    paypalEmail: "email_mm6rbhws",
    city: "text_mm6rze86",
    state: "text_mm6rfd5p",
    postal: "text_mm6r1bhz",
    address: "company_address_mkkfq4p8",
    appVendorId: "text_mm6sp488",
  },
} as const;

/** Status label indexes on the Payments board. */
const PAYMENT_STATUS_INDEX: Record<string, number> = {
  draft: 17,
  submitted: 7,
  awaiting_approval: 7,
  approved: 8,
  rejected: 2,
  awaiting_payment: 4,
  paid: 6,
  awaiting_invoice: 0,
  completed: 1,
  cancelled: 10,
};
const APPROVAL_INDEX: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
const INVOICE_INDEX: Record<string, number> = { attached: 7, received: 1, pending: 2 };
const METHOD_INDEX: Record<string, number> = { paypal: 3, bank_transfer: 7 };

const CATEGORY_LABELS = [
  "Logistics",
  "Administration",
  "Advertising",
  "Production",
  "Manufacturing",
  "Freelancer",
  "Marketing",
  "Travel",
  "Professional Services",
  "Supplier",
  "Software",
  "Operations",
  "Other",
];

function appBaseUrl(): string {
  return process.env["APP_BASE_URL"] ?? "https://pay-approver-pro.lovable.app";
}

export function mondayConfigured(): boolean {
  return Boolean(process.env["MONDAY_API_TOKEN"]);
}

/** Mask any account identifier down to the last four characters. */
function mask(value: string | null | undefined): string {
  if (!value) return "";
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return "****";
  return `****${clean.slice(-4)}`;
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env["MONDAY_API_TOKEN"];
  if (!token) throw new Error("MONDAY_API_TOKEN is not configured.");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[]; error_message?: string };
  if (!res.ok || json.errors?.length || json.error_message) {
    const message = json.errors?.map((e) => e.message).join("; ") ?? json.error_message ?? `HTTP ${res.status}`;
    throw new Error(`Monday API: ${message}`);
  }
  if (!json.data) throw new Error("Monday API returned no data.");
  return json.data;
}

/* ------------------------------------------------------------------ users */

let userCache: { at: number; byEmail: Map<string, string> } | undefined;
const USER_TTL = 10 * 60_000;

async function mondayUserId(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  if (!userCache || Date.now() - userCache.at > USER_TTL) {
    const data = await gql<{ users: { id: string; email: string }[] }>(
      "{ users(limit:200){ id email } }",
    );
    userCache = {
      at: Date.now(),
      byEmail: new Map(data.users.map((u) => [u.email.toLowerCase(), String(u.id)])),
    };
  }
  return userCache.byEmail.get(email.toLowerCase()) ?? null;
}

/* --------------------------------------------------------------- helpers */

type ColumnValues = Record<string, unknown>;

function statusValue(index: number | undefined): { index: number } | undefined {
  return index === undefined ? undefined : { index };
}

function dropdownValue(label: string | null | undefined) {
  return label ? { labels: [label] } : undefined;
}

function peopleValue(userId: string | null) {
  return userId ? { personsAndTeams: [{ id: Number(userId), kind: "person" }] } : undefined;
}

function categoryLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return CATEGORY_LABELS.find((l) => l.toLowerCase() === normalized) ?? "Other";
}

function clean(values: ColumnValues): ColumnValues {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

async function createItem(boardId: string, name: string, values: ColumnValues): Promise<string> {
  const data = await gql<{ create_item: { id: string } }>(
    `mutation($board:ID!,$name:String!,$vals:JSON!){ create_item(board_id:$board,item_name:$name,column_values:$vals,create_labels_if_missing:false){ id } }`,
    { board: boardId, name, vals: JSON.stringify(clean(values)) },
  );
  return String(data.create_item.id);
}

async function updateItem(boardId: string, itemId: string, values: ColumnValues): Promise<void> {
  await gql(
    `mutation($board:ID!,$item:ID!,$vals:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$vals,create_labels_if_missing:false){ id } }`,
    { board: boardId, item: itemId, vals: JSON.stringify(clean(values)) },
  );
}

async function itemExists(itemId: string): Promise<boolean> {
  const data = await gql<{ items: { id: string }[] }>(`{ items(ids:[${Number(itemId)}]){ id } }`);
  return (data.items ?? []).length > 0;
}

/* ------------------------------------------------------------- vendor sync */

/** Create or update the vendor's item on Management → 📞 Contacts. */
export async function syncVendorContact(admin: Admin, vendorId: string): Promise<string | null> {
  const { data: vendor } = await admin.from("vendors").select("*").eq("id", vendorId).maybeSingle();
  if (!vendor) throw new Error("Vendor not found for Monday sync.");

  const { data: bank } = await admin
    .from("vendor_bank_accounts")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const values: ColumnValues = {
    [MONDAY.contacts.companyName]: vendor.vendor_name,
    [MONDAY.contacts.contactPerson]: [vendor.contact_first_name, vendor.contact_last_name]
      .filter(Boolean)
      .join(" "),
    [MONDAY.contacts.country]: vendor.country ?? "",
    [MONDAY.contacts.email]: vendor.email ? { email: vendor.email, text: vendor.email } : undefined,
    [MONDAY.contacts.phone]: vendor.phone ?? "",
    [MONDAY.contacts.city]: vendor.city ?? "",
    [MONDAY.contacts.state]: vendor.state_province ?? "",
    [MONDAY.contacts.postal]: vendor.postal_code ?? "",
    [MONDAY.contacts.address]: vendor.address_line ?? "",
    [MONDAY.contacts.beneficiaryName]: vendor.beneficiary_name ?? "",
    [MONDAY.contacts.preferredCurrency]: dropdownValue(vendor.preferred_currency),
    [MONDAY.contacts.preferredMethod]: statusValue(
      vendor.preferred_payment_method ? METHOD_INDEX[vendor.preferred_payment_method] : undefined,
    ),
    [MONDAY.contacts.appVendorId]: vendor.id,
  };

  if (bank) {
    // Bank NAME and COUNTRY are operational metadata; the account identifier is
    // masked to the last four characters. Full IBAN/account/SWIFT never leaves
    // the database.
    values[MONDAY.contacts.bankName] = bank.bank_name ?? "";
    values[MONDAY.contacts.bankCountry] = bank.bank_country ?? "";
    values[MONDAY.contacts.maskedAccount] = mask(bank.iban ?? bank.account_number ?? null);
    if (bank.paypal_email) {
      values[MONDAY.contacts.paypalEmail] = { email: bank.paypal_email, text: bank.paypal_email };
    }
  }

  let itemId = vendor.monday_contact_id;
  if (itemId && !(await itemExists(itemId))) itemId = null;

  if (itemId) {
    await updateItem(MONDAY.contactsBoard, itemId, values);
  } else {
    itemId = await createItem(MONDAY.contactsBoard, vendor.vendor_name, values);
  }

  await admin
    .from("vendors")
    .update({ monday_contact_id: itemId, monday_synced_at: new Date().toISOString() })
    .eq("id", vendorId);

  return itemId;
}

/* ------------------------------------------------------ payment item sync */

/** Create the Monday item for a payment request, or update the existing one. */
export async function syncPaymentItem(admin: Admin, requestId: string): Promise<string | null> {
  const { data: request } = await admin
    .from("payment_requests")
    .select("*, vendors(id, vendor_name, email, monday_contact_id)")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) throw new Error("Payment request not found for Monday sync.");

  const vendor = request.vendors as { id: string; vendor_name: string; monday_contact_id: string | null } | null;
  let contactId = vendor?.monday_contact_id ?? null;
  if (vendor && !contactId) {
    contactId = await syncVendorContact(admin, vendor.id);
  }

  const { data: approver } = request.approved_by
    ? await admin.from("profiles").select("email").eq("id", request.approved_by).maybeSingle()
    : { data: null };

  const { data: transaction } = await admin
    .from("payment_transactions")
    .select("paid_on, amount_paid, currency_paid, reference, recorded_by")
    .eq("payment_request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: payer } = transaction?.recorded_by
    ? await admin.from("profiles").select("email").eq("id", transaction.recorded_by).maybeSingle()
    : { data: null };

  // Payment manager assignment: Kim owns approved payments awaiting settlement.
  const managerEmail =
    request.status === "awaiting_payment" || request.status === "approved" ? "kim@ziporra.com" : null;

  const approvalState =
    request.status === "rejected" ? "rejected" : request.approved_at ? "approved" : "pending";

  const values: ColumnValues = {
    [MONDAY.payments.appId]: request.request_number,
    [MONDAY.payments.appLink]: {
      url: `${appBaseUrl()}/payments/${request.id}`,
      text: request.request_number,
    },
    [MONDAY.payments.amount]: Number(request.amount),
    [MONDAY.payments.currency]: dropdownValue(request.currency),
    [MONDAY.payments.description]: request.description ?? "",
    [MONDAY.payments.invoiceNumber]: request.invoice_number ?? "",
    [MONDAY.payments.requestedDate]: request.due_date ? { date: request.due_date } : undefined,
    [MONDAY.payments.paymentStatus]: statusValue(PAYMENT_STATUS_INDEX[request.status]),
    [MONDAY.payments.approval]: statusValue(APPROVAL_INDEX[approvalState]),
    [MONDAY.payments.invoiceStatus]: statusValue(INVOICE_INDEX[request.invoice_status]),
    [MONDAY.payments.paymentMethod]: statusValue(METHOD_INDEX[request.payment_method]),
    [MONDAY.payments.duplicate]: statusValue(request.possible_duplicate ? 0 : 1),
    [MONDAY.payments.notes]: request.notes ?? "",
    [MONDAY.payments.approvedBy]: peopleValue(await mondayUserId(approver?.email)),
    [MONDAY.payments.owner]: peopleValue(await mondayUserId(managerEmail)),
    [MONDAY.payments.approvalDate]: request.approved_at
      ? { date: request.approved_at.slice(0, 10) }
      : undefined,
    [MONDAY.payments.rejectionReason]: request.rejection_reason ?? "",
    [MONDAY.payments.actualPaymentDate]: request.paid_at ? { date: request.paid_at.slice(0, 10) } : undefined,
  };

  if (transaction) {
    values[MONDAY.payments.amountPaid] = Number(transaction.amount_paid);
    values[MONDAY.payments.currencyPaid] = dropdownValue(transaction.currency_paid);
    values[MONDAY.payments.paymentReference] = transaction.reference ?? "";
    values[MONDAY.payments.paidBy] = peopleValue(await mondayUserId(payer?.email));
  }

  if (contactId) {
    values[MONDAY.payments.vendorRelation] = { item_ids: [Number(contactId)] };
  }

  const category = categoryLabel(request.category);
  if (category) values[MONDAY.payments.paymentInfo] = `Category: ${category}`;

  let itemId = request.monday_item_id;
  if (itemId && !(await itemExists(itemId))) itemId = null;

  const itemName = `${request.request_number} — ${vendor?.vendor_name ?? "Vendor"}`;
  if (itemId) {
    await updateItem(MONDAY.paymentsBoard, itemId, values);
  } else {
    itemId = await createItem(MONDAY.paymentsBoard, itemName, values);
  }

  await admin
    .from("payment_requests")
    .update({
      monday_item_id: itemId,
      monday_synced_at: new Date().toISOString(),
      monday_sync_status: "synced",
    })
    .eq("id", requestId);

  return itemId;
}

/* ----------------------------------------------------------- file sync */

/** Push a stored document into a Monday files column. Best-effort. */
export async function syncPaymentDocument(
  admin: Admin,
  requestId: string,
  docType: "invoice" | "proforma" | "proof_of_payment",
): Promise<void> {
  const { data: request } = await admin
    .from("payment_requests")
    .select("monday_item_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request?.monday_item_id) throw new Error("No Monday item to attach the document to.");

  const { data: doc } = await admin
    .from("payment_documents")
    .select("storage_path, file_name, mime_type")
    .eq("payment_request_id", requestId)
    .eq("doc_type", docType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc) return;

  const { data: file, error } = await admin.storage.from("payment-documents").download(doc.storage_path);
  if (error || !file) throw new Error("Could not read the stored document.");

  const columnId =
    docType === "proof_of_payment"
      ? MONDAY.payments.proofOfPayment
      : docType === "invoice"
        ? MONDAY.payments.finalInvoice
        : MONDAY.payments.supportingDoc;

  const token = process.env["MONDAY_API_TOKEN"]!;
  const form = new FormData();
  form.append(
    "query",
    `mutation($file:File!){ add_file_to_column(item_id:${Number(request.monday_item_id)}, column_id:"${columnId}", file:$file){ id } }`,
  );
  form.append("variables[file]", new Blob([await file.arrayBuffer()], { type: doc.mime_type }), doc.file_name);
  form.append("map", '{"variables[file]":"variables.file"}');

  const res = await fetch(`${API_URL}/file`, {
    method: "POST",
    headers: { Authorization: token, "API-Version": API_VERSION },
    body: form,
  });
  const json = (await res.json()) as { errors?: { message: string }[]; error_message?: string };
  if (!res.ok || json.errors?.length || json.error_message) {
    throw new Error(
      `Monday file upload: ${json.errors?.map((e) => e.message).join("; ") ?? json.error_message ?? res.status}`,
    );
  }
}

/* -------------------------------------------------------- sync dispatcher */

export type MondayAction =
  | "create_item"
  | "update_item"
  | "sync_vendor"
  | "upload_invoice"
  | "upload_proof";

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 180];

async function performAction(
  admin: Admin,
  action: MondayAction,
  paymentRequestId: string | null,
  vendorId: string | null,
): Promise<string | null> {
  switch (action) {
    case "sync_vendor":
      return syncVendorContact(admin, vendorId!);
    case "upload_invoice":
      await syncPaymentDocument(admin, paymentRequestId!, "invoice");
      return null;
    case "upload_proof":
      await syncPaymentDocument(admin, paymentRequestId!, "proof_of_payment");
      return null;
    default:
      return syncPaymentItem(admin, paymentRequestId!);
  }
}

/**
 * Queue and immediately attempt one Monday operation.
 *
 * Never throws: any failure is recorded in `monday_sync_logs` as pending with a
 * retry time, so the payment workflow completes regardless of Monday's health.
 */
export async function dispatchMondaySync(
  admin: Admin,
  input: {
    action: MondayAction;
    paymentRequestId?: string | null;
    vendorId?: string | null;
  },
): Promise<void> {
  const paymentRequestId = input.paymentRequestId ?? null;
  const vendorId = input.vendorId ?? null;
  const entityType = input.action === "sync_vendor" ? "vendor" : "payment_request";
  const boardId = entityType === "vendor" ? MONDAY.contactsBoard : MONDAY.paymentsBoard;

  const { data: log } = await admin
    .from("monday_sync_logs")
    .insert({
      action: input.action,
      entity_type: entityType,
      board_id: boardId,
      payment_request_id: paymentRequestId,
      vendor_id: vendorId,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();

  if (!mondayConfigured()) return;

  try {
    const itemId = await performAction(admin, input.action, paymentRequestId, vendorId);
    if (log) {
      await admin
        .from("monday_sync_logs")
        .update({ status: "success", attempts: 1, monday_item_id: itemId, error: null })
        .eq("id", log.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Monday] sync failed", message);
    if (log) {
      await admin
        .from("monday_sync_logs")
        .update({
          status: "pending",
          attempts: 1,
          error: message.slice(0, 500),
          next_attempt_at: new Date(Date.now() + BACKOFF_MINUTES[0]! * 60_000).toISOString(),
        })
        .eq("id", log.id);
    }
    if (paymentRequestId) {
      await admin
        .from("payment_requests")
        .update({ monday_sync_status: "failed" })
        .eq("id", paymentRequestId);
    }
  }
}

/** Retry queued operations that have not yet succeeded. */
export async function processPendingMondaySyncs(limit = 25): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Admin;

  if (!mondayConfigured()) return { processed: 0, succeeded: 0, failed: 0 };

  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("monday_sync_logs")
    .select("id, action, payment_request_id, vendor_id, attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  let succeeded = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const attempts = (row.attempts ?? 0) + 1;
    try {
      const itemId = await performAction(
        admin,
        row.action as MondayAction,
        row.payment_request_id,
        row.vendor_id,
      );
      await admin
        .from("monday_sync_logs")
        .update({ status: "success", attempts, monday_item_id: itemId, error: null })
        .eq("id", row.id);
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = attempts >= MAX_ATTEMPTS;
      await admin
        .from("monday_sync_logs")
        .update({
          status: exhausted ? "failed" : "pending",
          attempts,
          error: message.slice(0, 500),
          next_attempt_at: exhausted
            ? null
            : new Date(
                Date.now() + (BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)] ?? 60) * 60_000,
              ).toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return { processed: (rows ?? []).length, succeeded, failed };
}
