/** Pure helpers shared by the monthly expense views, server actions and tests. */

export const EXPENSE_TYPES = [
  "supplier",
  "salary",
  "pension",
  "tax_deduction",
  "subscription",
  "other",
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

/** Expense kinds that carry payroll-sensitive information. */
export const SENSITIVE_EXPENSE_TYPES: ExpenseType[] = ["salary", "pension", "tax_deduction"];

export function isSensitiveExpense(type: ExpenseType, employeeId?: string | null): boolean {
  return SENSITIVE_EXPENSE_TYPES.includes(type) || !!employeeId;
}

export const PAID_STATUSES = ["paid", "completed"] as const;
export const CLOSED_STATUSES = ["paid", "completed", "rejected", "cancelled"] as const;

/** Normalise any date to the first day of its accounting month (YYYY-MM-01). */
export function monthKey(input: string | Date): string {
  const d = typeof input === "string" ? new Date(`${input.slice(0, 10)}T00:00:00Z`) : input;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(now);
}

/** A descending list of month keys, starting at `from` and going back. */
export function recentMonths(count = 15, from: Date = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  for (let i = 0; i < count; i += 1) {
    out.push(monthKey(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

export function formatMonth(month: string, locale = "en"): string {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Due date for a template inside an accounting month, clamped to day 1-28. */
export function templateDueDate(month: string, dueDay: number): string {
  const day = Math.min(28, Math.max(1, Math.round(dueDay)));
  return `${month.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

export type ExpenseTotalRow = {
  amount: number | string;
  currency: string;
  status: string;
};

export type CurrencyTotals = {
  currency: string;
  planned: number;
  paid: number;
  count: number;
};

/**
 * Totals per currency. Currencies are never mixed or converted: planned holds
 * everything still outstanding, paid holds what has actually gone out.
 */
export function totalsByCurrency(rows: ExpenseTotalRow[]): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  for (const row of rows) {
    const status = row.status;
    if (status === "rejected" || status === "cancelled") continue;
    const amount = Number(row.amount) || 0;
    const entry = map.get(row.currency) ?? { currency: row.currency, planned: 0, paid: 0, count: 0 };
    if ((PAID_STATUSES as readonly string[]).includes(status)) entry.paid += amount;
    else entry.planned += amount;
    entry.count += 1;
    map.set(row.currency, entry);
  }
  return [...map.values()].sort((a, b) => b.planned + b.paid - (a.planned + a.paid));
}

/** Accessible status presentation: colour is always paired with a text label. */
export const STATUS_TONE: Record<string, "neutral" | "pending" | "positive" | "negative" | "warning"> = {
  draft: "neutral",
  submitted: "pending",
  awaiting_approval: "pending",
  approved: "positive",
  awaiting_payment: "warning",
  awaiting_invoice: "warning",
  paid: "positive",
  completed: "positive",
  rejected: "negative",
  cancelled: "neutral",
};
