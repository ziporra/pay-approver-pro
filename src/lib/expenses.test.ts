import { describe, expect, it } from "vitest";

import {
  currentMonthKey,
  isSensitiveExpense,
  monthKey,
  normalizeCurrency,
  recentMonths,
  templateDueDate,
  totalsByCurrency,
} from "./expenses";
import {
  canSaveVendor,
  isCrossBorder,
  missingPayoutFields,
  missingVendorProfileFields,
} from "./vendor-completeness";

describe("vendor profile saving vs payout readiness", () => {
  it("saves a supplier with only a name", () => {
    expect(missingVendorProfileFields({ vendor_name: "Acme Ltd" })).toEqual([]);
    expect(canSaveVendor({ vendor_name: "Acme Ltd" })).toBe(true);
  });

  it("refuses to save a supplier without a name", () => {
    expect(canSaveVendor({ vendor_name: "" })).toBe(false);
  });

  it("still reports what is missing for a payout", () => {
    const missing = missingPayoutFields({ vendor_name: "Acme Ltd" });
    expect(missing).toContain("method");
  });

  it("does not ask a PayPal vendor for bank fields", () => {
    expect(
      missingPayoutFields({ vendor_name: "Acme", method: "paypal", paypal_email: "pay@acme.com" }),
    ).toEqual([]);
  });

  it("accepts an IBAN alone as the account identifier", () => {
    expect(
      missingPayoutFields({
        vendor_name: "Acme",
        beneficiary_name: "Acme Ltd",
        method: "bank_transfer",
        bank_name: "Bank Leumi",
        bank_country: "Israel",
        country: "Israel",
        iban: "IL620108000000099999999",
      }),
    ).toEqual([]);
  });

  it("accepts an account number alone as the account identifier", () => {
    expect(
      missingPayoutFields({
        vendor_name: "Acme",
        beneficiary_name: "Acme Ltd",
        method: "bank_transfer",
        bank_name: "Chase",
        bank_country: "United States",
        country: "United States",
        account_number: "123456789",
      }),
    ).toEqual([]);
  });

  it("requires SWIFT only for cross-border transfers", () => {
    const base = {
      vendor_name: "Acme",
      beneficiary_name: "Acme Ltd",
      method: "bank_transfer" as const,
      bank_name: "Chase",
      account_number: "123456789",
    };
    expect(missingPayoutFields({ ...base, country: "United States", bank_country: "United States" })).toEqual(
      [],
    );
    expect(missingPayoutFields({ ...base, country: "Israel", bank_country: "United States" })).toContain(
      "swift_bic",
    );
    expect(isCrossBorder({ country: "Israel", bank_country: "United States" })).toBe(true);
  });

  it("never invents a currency or an email", () => {
    const missing = missingPayoutFields({ vendor_name: "Acme", method: "paypal" });
    expect(missing).toContain("paypal_email");
  });
});

describe("accounting months", () => {
  it("normalises any date to the first of its month", () => {
    expect(monthKey("2026-09-23")).toBe("2026-09-01");
    expect(monthKey(new Date(Date.UTC(2026, 0, 31)))).toBe("2026-01-01");
  });

  it("lists recent months descending", () => {
    const months = recentMonths(3, new Date(Date.UTC(2026, 2, 15)));
    expect(months).toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
  });

  it("clamps template due days into the month", () => {
    expect(templateDueDate("2026-02-01", 31)).toBe("2026-02-28");
    expect(templateDueDate("2026-02-01", 10)).toBe("2026-02-10");
  });

  it("returns a valid current month", () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe("currency separation", () => {
  it("keeps planned and paid apart per currency and never converts", () => {
    const totals = totalsByCurrency([
      { amount: 100, currency: "USD", status: "awaiting_payment" },
      { amount: 50, currency: "USD", status: "paid" },
      { amount: 900, currency: "ILS", status: "draft" },
      { amount: 10, currency: "USD", status: "cancelled" },
      { amount: 20, currency: "EUR", status: "rejected" },
    ]);
    const usd = totals.find((t) => t.currency === "USD");
    const ils = totals.find((t) => t.currency === "ILS");
    expect(usd).toMatchObject({ planned: 100, paid: 50, count: 2 });
    expect(ils).toMatchObject({ planned: 900, paid: 0 });
    expect(totals.find((t) => t.currency === "EUR")).toBeUndefined();
    expect(totals.reduce((n, t) => n + t.planned, 0)).toBe(1000);
  });
});

describe("payroll sensitivity", () => {
  it("marks payroll-type expenses and any employee expense as sensitive", () => {
    expect(isSensitiveExpense("salary")).toBe(true);
    expect(isSensitiveExpense("pension")).toBe(true);
    expect(isSensitiveExpense("tax_deduction")).toBe(true);
    expect(isSensitiveExpense("supplier")).toBe(false);
    expect(isSensitiveExpense("supplier", "b0b3f2f0-0000-4000-8000-000000000000")).toBe(true);
  });
});

describe("normalizeCurrency", () => {
  it("rejects blank and unknown currencies", () => {
    expect(normalizeCurrency("")).toBeNull();
    expect(normalizeCurrency(null)).toBeNull();
    expect(normalizeCurrency("XYZ")).toBeNull();
    expect(normalizeCurrency("US")).toBeNull();
  });
  it("accepts known codes case-insensitively", () => {
    expect(normalizeCurrency("usd")).toBe("USD");
    expect(normalizeCurrency(" ils ")).toBe("ILS");
  });
});
