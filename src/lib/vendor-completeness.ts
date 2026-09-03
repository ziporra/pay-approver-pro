/** Shared rules that decide whether a vendor profile is complete enough to be paid. */

export type VendorProfileCheck = {
  vendor_name?: string | null;
  beneficiary_name?: string | null;
  email?: string | null;
  country?: string | null;
  method?: "paypal" | "bank_transfer" | null;
  paypal_email?: string | null;
  bank_name?: string | null;
  bank_country?: string | null;
  swift_bic?: string | null;
  iban?: string | null;
  account_number?: string | null;
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

/** Returns the list of required fields that are still missing. Empty = complete. */
export function missingVendorFields(vendor: VendorProfileCheck): string[] {
  const missing: string[] = [];
  if (blank(vendor.vendor_name)) missing.push("vendor_name");
  if (blank(vendor.beneficiary_name)) missing.push("beneficiary_name");
  if (!vendor.email || !EMAIL.test(vendor.email.trim())) missing.push("email");
  if (blank(vendor.country)) missing.push("country");

  if (vendor.method === "paypal") {
    if (!vendor.paypal_email || !EMAIL.test(vendor.paypal_email.trim())) missing.push("paypal_email");
  } else if (vendor.method === "bank_transfer") {
    if (blank(vendor.bank_name)) missing.push("bank_name");
    if (blank(vendor.bank_country)) missing.push("bank_country");
    if (blank(vendor.iban, 5) && blank(vendor.account_number, 4)) missing.push("iban");
    if (blank(vendor.iban, 5) && blank(vendor.swift_bic, 8)) missing.push("swift_bic");
  } else {
    missing.push("method");
  }
  return missing;
}

export function isVendorComplete(vendor: VendorProfileCheck): boolean {
  return missingVendorFields(vendor).length === 0;
}
