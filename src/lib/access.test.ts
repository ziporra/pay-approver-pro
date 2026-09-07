import { describe, expect, it } from "vitest";

import { PAYROLL_ROLES, hasAny, requirePayrollAccess, requireRoles } from "./access.server";
import { generateDraftsForMonth, type RecurringTemplate } from "./recurring.server";

/** Minimal stand-in for the Supabase client used by the role helpers. */
function clientWithRoles(roles: string[]) {
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: roles.map((role) => ({ role })), error: null }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("access boundaries", () => {
  it("lets payroll-cleared roles through", async () => {
    for (const role of PAYROLL_ROLES) {
      await expect(requirePayrollAccess(clientWithRoles([role]), "u1")).resolves.toBeTruthy();
    }
  });

  it("blocks approvers and viewers from employee data", async () => {
    await expect(requirePayrollAccess(clientWithRoles(["approver"]), "u1")).rejects.toThrow(
      /not authorised/i,
    );
    await expect(requirePayrollAccess(clientWithRoles(["viewer"]), "u1")).rejects.toThrow(
      /not authorised/i,
    );
  });

  it("blocks accounts with no role at all", async () => {
    await expect(requireRoles(clientWithRoles([]), "u1", ["admin"])).rejects.toThrow(/no access/i);
  });

  it("matches any of the allowed roles", () => {
    expect(hasAny(["accounting"], PAYROLL_ROLES)).toBe(true);
    expect(hasAny(["viewer"], PAYROLL_ROLES)).toBe(false);
  });
});

const templates: RecurringTemplate[] = [
  {
    id: "t-rent",
    expense_type: "subscription",
    vendor_id: "v1",
    employee_id: null,
    recipient_name: null,
    amount: 1200,
    currency: "USD",
    description: "Office rent",
    category: "operations",
    payment_method: "bank_transfer",
    due_day: 5,
  },
  {
    id: "t-salary",
    expense_type: "salary",
    vendor_id: null,
    employee_id: "e1",
    recipient_name: null,
    amount: 8000,
    currency: "ILS",
    description: "Monthly salary",
    category: null,
    payment_method: "bank_transfer",
    due_day: 9,
  },
];

/** Fake table that enforces the unique (template_id, accounting_month) index. */
function fakeTable() {
  const seen = new Set<string>();
  let n = 0;
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    insert: async (row: Record<string, unknown>) => {
      const key = `${row['template_id']}|${row['accounting_month']}`;
      if (seen.has(key)) return { conflict: true };
      seen.add(key);
      rows.push(row);
      n += 1;
      return { id: `r${n}` };
    },
  };
}

describe("recurring generation", () => {
  it("creates one draft per template and is retry-safe", async () => {
    const table = fakeTable();
    const first = await generateDraftsForMonth(templates, "2026-09-01", table.insert, {
      payrollAllowed: true,
    });
    expect(first.created).toBe(2);
    expect(first.skipped).toBe(0);

    const retry = await generateDraftsForMonth(templates, "2026-09-01", table.insert, {
      payrollAllowed: true,
    });
    expect(retry.created).toBe(0);
    expect(retry.skipped).toBe(2);
    expect(table.rows).toHaveLength(2);
  });

  it("only ever creates drafts, dated inside the accounting month", async () => {
    const table = fakeTable();
    await generateDraftsForMonth(templates, "2026-10-01", table.insert, { payrollAllowed: true });
    expect(table.rows.every((r) => r['status'] === "draft")).toBe(true);
    expect(table.rows.map((r) => r['due_date'])).toEqual(["2026-10-05", "2026-10-09"]);
  });

  it("skips payroll templates for staff without payroll access", async () => {
    const table = fakeTable();
    const result = await generateDraftsForMonth(templates, "2026-11-01", table.insert, {
      payrollAllowed: false,
    });
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(table.rows.every((r) => r['expense_type'] !== "salary")).toBe(true);
  });

  it("separates the next month from the current one", async () => {
    const table = fakeTable();
    await generateDraftsForMonth(templates, "2026-09-01", table.insert, { payrollAllowed: true });
    const next = await generateDraftsForMonth(templates, "2026-10-01", table.insert, {
      payrollAllowed: true,
    });
    expect(next.created).toBe(2);
    expect(table.rows).toHaveLength(4);
  });
});
