import { describe, expect, it } from "vitest";
import { EXCLUDED_MONDAY_ITEM_IDS, mapContact } from "./monday-import.server";
import { MONDAY } from "./monday.server";

type Col = { id: string; text?: string | null; value?: string | null };
function item(id: string, name: string, columns: Col[] = []) {
  return { id, name, column_values: columns } as never;
}

describe("monday contact mapping", () => {
  it("excludes the synthetic QA item", () => {
    expect(EXCLUDED_MONDAY_ITEM_IDS).toContain("3210115337");
  });

  it("flags a contact with no email, phone or address as needing review", () => {
    const mapped = mapContact(item("1752642940", "Luxury lifestyle magazine"));
    expect(mapped.sparse).toBe(true);
    expect(mapped.vendor.vendor_name).toBe("Luxury lifestyle magazine");
  });

  it("does not flag a contact that has contact details", () => {
    const mapped = mapContact(
      item("1", "Acme", [{ id: MONDAY.contacts.email, text: "billing@acme.com" }]),
    );
    expect(mapped.sparse).toBe(false);
  });

  it("never treats a masked account identifier as a payable account number", () => {
    const mapped = mapContact(
      item("2", "Acme", [{ id: MONDAY.contacts.maskedAccount, text: "****1234" }]),
    );
    expect(Object.keys(mapped.bank ?? {})).not.toContain("account_number");
    expect(Object.keys(mapped.bank ?? {})).not.toContain("iban");
  });
});
