export function formatMoney(amount: number | string, currency: string, locale = "en"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDate(value: string | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

export type DueUrgency = { label: string; tone: "overdue" | "today" | "soon" | "normal"; days: number };

export function dueUrgency(dueDate: string | null | undefined): DueUrgency | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: "Overdue", tone: "overdue", days };
  if (days === 0) return { label: "Due today", tone: "today", days };
  if (days === 1) return { label: "Due tomorrow", tone: "soon", days };
  return { label: `Due in ${days} days`, tone: days <= 7 ? "soon" : "normal", days };
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  awaiting_invoice: "Awaiting invoice",
  completed: "Completed",
  cancelled: "Cancelled",
};
