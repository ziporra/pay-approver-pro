/**
 * Two separate ideas, deliberately kept apart:
 *  - profile saving: a supplier can be stored with only a name;
 *  - payout readiness: what must exist before money can actually be sent.
 */

export type VendorProfileCheck = {
  vendor_name?: string | null | undefined;
  beneficiary_name?: string | null | undefined;
  email?: string | null | undefined;
  country?: string | null | undefined;
  method?: "paypal" | "bank_transfer" | null | undefined;
  paypal_email?: string | null | undefined;
  bank_name?: string | null | undefined;
  bank_country?: string | null | undefined;
  swift_bic?: string | null | undefined;
  iban?: string | null | undefined;
  account_number?: string | null | undefined;
};

/** i18n keys used to label a missing field in the UI. */
export const VENDOR_FIELD_LABEL_KEYS: Record<string, string> = {
  vendor_name: "vendor.name",
  beneficiary_name: "vendor.beneficiary",
  email: "vendor.email",
  country: "vendor.country",
  method: "method.title",
  paypal_email: "paypal.email",
  bank_name: "bank.bankName",
  bank_country: "bank.bankCountry",
  iban: "bank.iban",
  account_number: "bank.account",
  swift_bic: "bank.swift",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function blank(value: string | null | undefined, min = 2): boolean {
  return !value || value.trim().length < min;
}

/** What a vendor record needs before it can be stored at all. Name only. */
export function missingVendorProfileFields(vendor: VendorProfileCheck): string[] {
  return blank(vendor.vendor_name) ? ["vendor_name"] : [];
}

export function canSaveVendor(vendor: VendorProfileCheck): boolean {
  return missingVendorProfileFields(vendor).length === 0;
}

/**
 * What is still missing before a payout can be made.
 * PayPal never requires bank fields. For a bank transfer an IBAN OR an account
 * number is enough as the identifier (both may be present). SWIFT/BIC is only
 * required when the transfer crosses a border.
 */
export function missingPayoutFields(vendor: VendorProfileCheck): string[] {
  const missing: string[] = [];
  if (blank(vendor.vendor_name)) missing.push("vendor_name");

  if (vendor.method === "paypal") {
    if (!vendor.paypal_email || !EMAIL.test(vendor.paypal_email.trim())) missing.push("paypal_email");
    return missing;
  }

  if (vendor.method === "bank_transfer") {
    if (blank(vendor.beneficiary_name)) missing.push("beneficiary_name");
    if (blank(vendor.bank_name)) missing.push("bank_name");
    if (blank(vendor.iban, 5) && blank(vendor.account_number, 4)) missing.push("account_number");
    if (isCrossBorder(vendor) && blank(vendor.swift_bic, 8)) missing.push("swift_bic");
    return missing;
  }

  missing.push("method");
  return missing;
}

/** A transfer is treated as domestic when the bank sits in the vendor's country. */
export function isCrossBorder(vendor: VendorProfileCheck): boolean {
  const bank = (vendor.bank_country ?? "").trim().toLowerCase();
  const country = (vendor.country ?? "").trim().toLowerCase();
  if (!bank || !country) return false;
  return bank !== country;
}

/** Backwards-compatible name used across the app: payout readiness. */
export const missingVendorFields = missingPayoutFields;

export function isVendorPayoutReady(vendor: VendorProfileCheck): boolean {
  return missingPayoutFields(vendor).length === 0;
}

export function isVendorComplete(vendor: VendorProfileCheck): boolean {
  return isVendorPayoutReady(vendor);
}
