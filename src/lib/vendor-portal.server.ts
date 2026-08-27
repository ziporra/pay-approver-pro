import { createHash } from "crypto";

import { maskEmail, maskPhone, maskTail } from "./masking";

export type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export async function getAdmin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Coarse rate limiting for anonymous vendor endpoints. */
export async function enforceRateLimit(
  admin: AdminClient,
  bucketKey: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await admin
    .from("public_form_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucketKey)
    .eq("action", action)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) {
    throw new Error("Too many attempts. Please wait a moment and try again.");
  }
  await admin.from("public_form_hits").insert({ bucket_key: bucketKey, action });
}

export function hashKey(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex").slice(0, 32);
}

export type MaskedVendor = {
  id: string;
  vendorName: string;
  beneficiaryName: string;
  contactName: string;
  maskedEmail: string;
  maskedPhone: string;
  city: string | null;
  country: string | null;
  preferredCurrency: string | null;
  method: "paypal" | "bank_transfer" | null;
  maskedPaymentSummary: string;
};

type VendorRow = {
  id: string;
  vendor_name: string;
  beneficiary_name: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  preferred_currency: string | null;
  preferred_payment_method: "paypal" | "bank_transfer" | null;
};

type BankRow = {
  method: "paypal" | "bank_transfer";
  paypal_email: string | null;
  iban: string | null;
  account_number: string | null;
  bank_name: string | null;
};

export function toMaskedVendor(vendor: VendorRow, bank: BankRow | null): MaskedVendor {
  let summary = "No payment details on file";
  if (bank?.method === "paypal") summary = `PayPal · ${maskEmail(bank.paypal_email)}`;
  if (bank?.method === "bank_transfer") {
    const id = bank.iban ?? bank.account_number;
    summary = `${bank.bank_name ?? "Bank transfer"} · ${maskTail(id)}`;
  }
  return {
    id: vendor.id,
    vendorName: vendor.vendor_name,
    beneficiaryName: vendor.beneficiary_name,
    contactName: [vendor.contact_first_name, vendor.contact_last_name].filter(Boolean).join(" "),
    maskedEmail: maskEmail(vendor.email),
    maskedPhone: maskPhone(vendor.phone),
    city: vendor.city,
    country: vendor.country,
    preferredCurrency: vendor.preferred_currency,
    method: vendor.preferred_payment_method ?? bank?.method ?? null,
    maskedPaymentSummary: summary,
  };
}

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function decodeUpload(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Invalid file upload.");
  const mime = match[1]!.toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) throw new Error("Only PDF, JPG and PNG files are accepted.");
  const buffer = Buffer.from(match[2]!, "base64");
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error("File is larger than 15 MB.");
  if (buffer.byteLength === 0) throw new Error("The uploaded file is empty.");
  return { bytes: new Uint8Array(buffer), mime };
}

/** Compare sensitive payment fields between old and new bank rows. */
export function diffSensitive(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
): { field: string; old_masked: string; new_masked: string }[] {
  if (!previous) return [];
  const fields = ["iban", "account_number", "swift_bic", "beneficiary_name", "paypal_email"];
  const changes: { field: string; old_masked: string; new_masked: string }[] = [];
  for (const field of fields) {
    const before = (previous[field] as string | null) ?? "";
    const after = (next[field] as string | null) ?? "";
    if (before && after && before !== after) {
      const mask = field === "paypal_email" ? maskEmail : maskTail;
      changes.push({ field, old_masked: mask(before), new_masked: mask(after) });
    }
  }
  return changes;
}

/** Convert undefined values to null so they satisfy exact optional DB types. */
type Nullified<T> = {
  [K in keyof T]-?: undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K];
};

export function nullify<T extends Record<string, unknown>>(obj: T): Nullified<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) out[key] = value === undefined ? null : value;
  return out as Nullified<T>;
}
