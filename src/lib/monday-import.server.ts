/**
 * Import and ongoing inbound synchronisation of the real supplier records that
 * live on the Monday "Management → 📞 Contacts" board (1752642705).
 *
 * Rules implemented here:
 *  - Supabase stays the source of truth. Monday values only ever FILL blanks;
 *    a richer value already stored in the app is never overwritten — the
 *    difference is recorded as a conflict and the supplier is flagged for review.
 *  - Matching is deterministic only: by `monday_contact_id`, or by a validated
 *    app vendor id printed on the Monday item. No fuzzy auto-merges.
 *  - Re-running is safe: `vendors.monday_contact_id` is unique, so a second run
 *    links instead of creating.
 *  - Banking: the Contacts board only holds a MASKED account identifier, so no
 *    account number/IBAN is ever imported. Bank name/country and PayPal e-mail
 *    are operational fields and are imported; a changed masked identifier is
 *    flagged, never applied.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { gql, MONDAY, mondayConfigured } from "./monday.server";
import { SORTED_CURRENCIES } from "./reference";

type Admin = SupabaseClient<Database>;

/** Synthetic QA record on the board — never imported. */
export const EXCLUDED_MONDAY_ITEM_IDS = ["3210115337"];

export type ImportOutcome = {
  mondayItemId: string;
  name: string;
  result: "created" | "linked" | "updated" | "unchanged" | "conflict" | "skipped" | "error";
  needsReview?: boolean | undefined;
  conflicts?: string[] | undefined;
  message?: string | undefined;
};

export type ImportSummary = {
  dryRun: boolean;
  scanned: number;
  created: number;
  linked: number;
  updated: number;
  conflicts: number;
  skipped: number;
  errors: number;
  outcomes: ImportOutcome[];
};

type RawItem = {
  id: string;
  name: string;
  column_values: { id: string; text: string | null }[];
};

/* ------------------------------------------------------------------ fetch */

export async function fetchContactItems(): Promise<RawItem[]> {
  const items: RawItem[] = [];
  let cursor: string | null = null;
  // Paginated: the board can grow beyond one page.
  for (let page = 0; page < 50; page += 1) {
    const data: {
      boards: { items_page: { cursor: string | null; items: RawItem[] } }[];
    } = await gql(
      `query($board:ID!,$cursor:String){
         boards(ids:[$board]){
           items_page(limit:100, cursor:$cursor){
             cursor
             items { id name column_values { id text } }
           }
         }
       }`,
      { board: MONDAY.contactsBoard, cursor },
    );
    const page_ = data.boards?.[0]?.items_page;
    if (!page_) break;
    items.push(...page_.items);
    cursor = page_.cursor;
    if (!cursor) break;
  }
  return items;
}

/* ---------------------------------------------------------------- mapping */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(item: RawItem, columnId: string): string | null {
  const value = item.column_values.find((c) => c.id === columnId)?.text ?? null;
  const clean = (value ?? "").trim();
  return clean.length > 0 ? clean : null;
}

function currency(value: string | null): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase().slice(0, 3);
  return SORTED_CURRENCIES.some((c) => c.code === code) ? code : null;
}

function method(value: string | null): "paypal" | "bank_transfer" | null {
  const v = (value ?? "").toLowerCase();
  if (v.includes("paypal")) return "paypal";
  if (v.includes("bank") || v.includes("transfer") || v.includes("wire")) return "bank_transfer";
  return null;
}

export type MappedContact = {
  mondayItemId: string;
  appVendorId: string | null;
  unnamed: boolean;
  vendor: {
    vendor_name: string;
    beneficiary_name: string | null;
    contact_first_name: string | null;
    contact_last_name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    state_province: string | null;
    postal_code: string | null;
    address_line: string | null;
    preferred_currency: string | null;
    preferred_payment_method: "paypal" | "bank_transfer" | null;
    category: string | null;
  };
  bank: {
    bank_name: string | null;
    bank_country: string | null;
    paypal_email: string | null;
  };
  maskedAccount: string | null;
};

export function mapContact(item: RawItem): MappedContact {
  const c = MONDAY.contacts;
  const company = text(item, c.companyName) ?? (item.name || "").trim();
  const person = text(item, c.contactPerson);
  const [first, ...rest] = (person ?? "").split(/\s+/).filter(Boolean);
  const unnamed = !company || /^unnamed$/i.test(company);

  return {
    mondayItemId: String(item.id),
    appVendorId: (() => {
      const raw = text(item, c.appVendorId);
      return raw && UUID.test(raw) ? raw.toLowerCase() : null;
    })(),
    unnamed,
    vendor: {
      vendor_name: unnamed ? `Unnamed contact #${item.id}` : company,
      beneficiary_name: text(item, c.beneficiaryName),
      contact_first_name: first ?? null,
      contact_last_name: rest.length ? rest.join(" ") : null,
      email: text(item, c.email)?.toLowerCase() ?? null,
      phone: text(item, c.phone),
      country: text(item, c.country),
      city: text(item, c.city),
      state_province: text(item, c.state),
      postal_code: text(item, c.postal),
      address_line: text(item, c.address),
      preferred_currency: currency(text(item, c.preferredCurrency)),
      preferred_payment_method: method(text(item, c.preferredMethod)),
      category: text(item, c.category),
    },
    bank: {
      bank_name: text(item, c.bankName),
      bank_country: text(item, c.bankCountry),
      paypal_email: text(item, c.paypalEmail)?.toLowerCase() ?? null,
    },
    maskedAccount: text(item, c.maskedAccount),
  };
}

/* -------------------------------------------------------- merge decisions */

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Blank app fields are filled from Monday; a different non-blank app value is
 * preserved and reported as a conflict.
 */
export function mergeVendor(
  existing: Record<string, unknown>,
  incoming: Record<string, string | null>,
): { patch: Record<string, string | null>; conflicts: string[] } {
  const patch: Record<string, string | null> = {};
  const conflicts: string[] = [];
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === "") continue;
    const current = existing[key];
    if (current === null || current === undefined || String(current).trim() === "") {
      patch[key] = value;
    } else if (norm(current) !== norm(value)) {
      conflicts.push(key);
    }
  }
  return { patch, conflicts };
}

/* ----------------------------------------------------------------- import */

async function applyOne(
  admin: Admin,
  mapped: MappedContact,
  dryRun: boolean,
): Promise<ImportOutcome> {
  const base: ImportOutcome = {
    mondayItemId: mapped.mondayItemId,
    name: mapped.vendor.vendor_name,
    result: "created",
  };

  // 1. deterministic match: monday item id, then a validated app vendor id.
  const { data: byMonday } = await admin
    .from("vendors")
    .select("*")
    .eq("monday_contact_id", mapped.mondayItemId)
    .maybeSingle();

  let existing = byMonday ?? null;
  let linkedByAppId = false;
  if (!existing && mapped.appVendorId) {
    const { data: byAppId } = await admin
      .from("vendors")
      .select("*")
      .eq("id", mapped.appVendorId)
      .maybeSingle();
    if (byAppId) {
      if (byAppId.monday_contact_id && byAppId.monday_contact_id !== mapped.mondayItemId) {
        return {
          ...base,
          result: "conflict",
          needsReview: true,
          conflicts: ["monday_contact_id"],
          message: "App record already linked to a different contact item.",
        };
      }
      existing = byAppId;
      linkedByAppId = true;
    } else {
      base.conflicts = ["unknown_app_vendor_id"];
      base.needsReview = true;
    }
  }

  const incoming = mapped.vendor as unknown as Record<string, string | null>;

  if (!existing) {
    if (dryRun) return { ...base, result: "created", needsReview: mapped.unnamed };
    const { data: created, error } = await admin
      .from("vendors")
      .insert({
        ...mapped.vendor,
        monday_contact_id: mapped.mondayItemId,
        monday_synced_at: new Date().toISOString(),
        import_source: "monday_contacts",
        needs_review: mapped.unnamed || Boolean(base.conflicts?.length),
        monday_conflicts: (base.conflicts ?? []) as unknown as never,
      })
      .select("id")
      .single();
    if (error) return { ...base, result: "error", message: error.message };
    await upsertBank(admin, created.id, mapped);
    return { ...base, result: "created", needsReview: mapped.unnamed };
  }

  const { patch, conflicts } = mergeVendor(existing as Record<string, unknown>, incoming);
  const allConflicts = [...(base.conflicts ?? []), ...conflicts];
  const bankFlag = await bankConflict(admin, existing.id, mapped);
  if (bankFlag) allConflicts.push(bankFlag);

  if (dryRun) {
    return {
      ...base,
      result: allConflicts.length ? "conflict" : Object.keys(patch).length ? "updated" : "linked",
      conflicts: allConflicts.length ? allConflicts : undefined,
      needsReview: allConflicts.length > 0,
    };
  }

  const { error } = await admin
    .from("vendors")
    .update({
      ...patch,
      monday_contact_id: mapped.mondayItemId,
      monday_synced_at: new Date().toISOString(),
      import_source: existing.import_source ?? "monday_contacts",
      needs_review: allConflicts.length > 0 ? true : existing.needs_review,
      monday_conflicts: allConflicts as unknown as never,
    })
    .eq("id", existing.id);
  if (error) return { ...base, result: "error", message: error.message };

  await upsertBank(admin, existing.id, mapped);

  return {
    ...base,
    name: existing.vendor_name,
    result: allConflicts.length
      ? "conflict"
      : linkedByAppId || !byMonday
        ? "linked"
        : Object.keys(patch).length
          ? "updated"
          : "unchanged",
    conflicts: allConflicts.length ? allConflicts : undefined,
    needsReview: allConflicts.length > 0,
  };
}

/** Report (never apply) a change to the masked account identifier. */
async function bankConflict(admin: Admin, vendorId: string, mapped: MappedContact) {
  if (!mapped.maskedAccount) return null;
  const { data: bank } = await admin
    .from("vendor_bank_accounts")
    .select("iban, account_number")
    .eq("vendor_id", vendorId)
    .eq("is_active", true)
    .maybeSingle();
  const local = (bank?.iban ?? bank?.account_number ?? "").replace(/\s+/g, "");
  if (!local) return null;
  const tail = mapped.maskedAccount.replace(/[^0-9A-Za-z]/g, "").slice(-4);
  if (tail && local.slice(-4).toLowerCase() !== tail.toLowerCase()) return "bank_account_identifier";
  return null;
}

/**
 * Only non-secret bank metadata and the PayPal address are imported. A masked
 * identifier can never become a payable account number.
 */
async function upsertBank(admin: Admin, vendorId: string, mapped: MappedContact) {
  const { bank_name, bank_country, paypal_email } = mapped.bank;
  if (!bank_name && !bank_country && !paypal_email) return;

  const { data: current } = await admin
    .from("vendor_bank_accounts")
    .select("id, bank_name, bank_country, paypal_email, method")
    .eq("vendor_id", vendorId)
    .eq("is_active", true)
    .maybeSingle();

  const method_ = mapped.vendor.preferred_payment_method ?? (paypal_email ? "paypal" : "bank_transfer");

  if (!current) {
    await admin.from("vendor_bank_accounts").insert({
      vendor_id: vendorId,
      method: method_,
      bank_name,
      bank_country,
      paypal_email,
      beneficiary_name: mapped.vendor.beneficiary_name,
      is_active: true,
      entry_source: "monday_import",
    });
    return;
  }

  const { patch } = mergeVendor(current as Record<string, unknown>, {
    bank_name,
    bank_country,
    paypal_email,
  });
  if (Object.keys(patch).length > 0) {
    await admin
      .from("vendor_bank_accounts")
      .update(patch as never)
      .eq("id", current.id);
  }
}

/** Dry-run / reconcile / real import of the Contacts board. */
export async function importMondayContacts(
  admin: Admin,
  options: { dryRun: boolean; startedBy?: string | null; kind?: string } = { dryRun: true },
): Promise<ImportSummary> {
  if (!mondayConfigured()) throw new Error("The Monday credential is not configured on the server.");

  const items = (await fetchContactItems()).filter(
    (item) => !EXCLUDED_MONDAY_ITEM_IDS.includes(String(item.id)),
  );

  const outcomes: ImportOutcome[] = [];
  for (const item of items) {
    try {
      outcomes.push(await applyOne(admin, mapContact(item), options.dryRun));
    } catch (error) {
      outcomes.push({
        mondayItemId: String(item.id),
        name: item.name,
        result: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const count = (r: ImportOutcome["result"]) => outcomes.filter((o) => o.result === r).length;
  const summary: ImportSummary = {
    dryRun: options.dryRun,
    scanned: items.length,
    created: count("created"),
    linked: count("linked") + count("unchanged"),
    updated: count("updated"),
    conflicts: count("conflict"),
    skipped: EXCLUDED_MONDAY_ITEM_IDS.length,
    errors: count("error"),
    outcomes,
  };

  await admin.from("monday_import_runs").insert({
    kind: options.kind ?? (options.dryRun ? "dry_run" : "import"),
    status: summary.errors > 0 ? "partial" : "success",
    scanned: summary.scanned,
    created_count: summary.created,
    linked_count: summary.linked + summary.updated,
    conflict_count: summary.conflicts,
    skipped_count: summary.skipped,
    error_count: summary.errors,
    started_by: options.startedBy ?? null,
    details: outcomes as unknown as never,
  });

  return summary;
}

/** Inbound: apply a single changed contact item (webhook driven). */
export async function syncInboundContact(admin: Admin, mondayItemId: string): Promise<ImportOutcome> {
  const data: { items: RawItem[] } = await gql(
    `query($id:ID!){ items(ids:[$id]){ id name column_values { id text } } }`,
    { id: mondayItemId },
  );
  const item = data.items?.[0];
  if (!item) return { mondayItemId, name: "", result: "skipped", message: "Item not found." };
  if (EXCLUDED_MONDAY_ITEM_IDS.includes(String(item.id)))
    return { mondayItemId, name: item.name, result: "skipped", message: "Excluded item." };

  // Loop prevention: ignore an echo of an update this app just pushed out.
  const { data: vendor } = await admin
    .from("vendors")
    .select("monday_synced_at")
    .eq("monday_contact_id", String(item.id))
    .maybeSingle();
  if (vendor?.monday_synced_at && Date.now() - new Date(vendor.monday_synced_at).getTime() < 90_000) {
    return { mondayItemId, name: item.name, result: "skipped", message: "Echo of our own update." };
  }

  const outcome = await applyOne(admin, mapContact(item), false);
  await admin.from("monday_import_runs").insert({
    kind: "inbound",
    status: outcome.result === "error" ? "partial" : "success",
    scanned: 1,
    created_count: outcome.result === "created" ? 1 : 0,
    linked_count: outcome.result === "updated" || outcome.result === "linked" ? 1 : 0,
    conflict_count: outcome.result === "conflict" ? 1 : 0,
    skipped_count: outcome.result === "skipped" ? 1 : 0,
    error_count: outcome.result === "error" ? 1 : 0,
    details: [outcome] as unknown as never,
  });
  return outcome;
}
