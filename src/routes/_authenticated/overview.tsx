import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EXPENSE_TYPES, formatMonth, recentMonths, currentMonthKey, type ExpenseType } from "@/lib/expenses";
import { createExpense, listMonthlyExpenses } from "@/lib/expenses.functions";
import { listEmployees } from "@/lib/employees.functions";
import { listVendors } from "@/lib/internal.functions";
import { formatDate, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { SORTED_CURRENCIES, PAYMENT_CATEGORIES } from "@/lib/reference";
import { useStaffProfile } from "@/lib/staff-profile";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Monthly overview — Ledgerline" },
      {
        name: "description",
        content: "Company expenses per accounting month, split by entity, category and currency.",
      },
      { property: "og:title", content: "Monthly overview — Ledgerline" },
      { property: "og:description", content: "Planned and paid totals per currency, per accounting month." },
    ],
  }),
  component: OverviewPage,
});

const STATUSES = [
  "draft",
  "submitted",
  "awaiting_approval",
  "approved",
  "awaiting_payment",
  "awaiting_invoice",
  "paid",
  "completed",
  "rejected",
  "cancelled",
] as const;

function OverviewPage() {
  const { t, locale } = useI18n();
  const { roles } = useStaffProfile();
  const payroll = roles.some((r) => ["admin", "accounting", "payment_manager"].includes(r));
  const canCreate = roles.some((r) =>
    ["admin", "accounting", "payment_manager", "approver"].includes(r),
  );

  const fetchExpenses = useServerFn(listMonthlyExpenses);
  const [month, setMonth] = useState(currentMonthKey());
  const [type, setType] = useState<"" | ExpenseType>("");
  const [status, setStatus] = useState("");
  const [entity, setEntity] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");

  const months = useMemo(() => recentMonths(15), []);
  const filters = { month, expense_type: type || null, status: status || null, entity, country, category };

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-expenses", filters],
    queryFn: () =>
      fetchExpenses({
        data: {
          month,
          expense_type: type || null,
          status: status || null,
          entity: entity || null,
          country: country || null,
          category: category || null,
        },
      }),
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("exp.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("exp.subtitle")}</p>
        </div>
        {canCreate ? <NewExpenseDialog payroll={payroll} month={month} /> : null}
      </div>

      <Card className="shadow-panel">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <Label htmlFor="f-month">{t("exp.month")}</Label>
            <select
              id="f-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="f-type">{t("exp.type")}</Label>
            <select
              id="f-type"
              value={type}
              onChange={(e) => setType(e.target.value as ExpenseType | "")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("exp.any")}</option>
              {EXPENSE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`exp.type.${v}` as "exp.type.supplier")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="f-status">{t("exp.status")}</Label>
            <select
              id="f-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("exp.any")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="f-category">{t("exp.category")}</Label>
            <select
              id="f-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("exp.any")}</option>
              {PAYMENT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="f-entity">{t("exp.entity")}</Label>
            <Input id="f-entity" value={entity} onChange={(e) => setEntity(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="f-country">{t("exp.country")}</Label>
            <Input
              id="f-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("table.empty")}</p>
        ) : (
          totals.map((total) => (
            <Card key={total.currency} className="shadow-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {total.currency} · {t("exp.items", { count: total.count })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
                  <span className="text-muted-foreground">{t("exp.planned")}</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(total.planned, total.currency, locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
                  <span className="text-muted-foreground">{t("exp.paid")}</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(total.paid, total.currency, locale)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="shadow-panel">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t("exp.recipient")}</th>
                  <th className="px-4 py-3 text-start">{t("exp.type")}</th>
                  <th className="px-4 py-3 text-start">{t("exp.description")}</th>
                  <th className="px-4 py-3 text-start">{t("exp.dueDate")}</th>
                  <th className="px-4 py-3 text-start">{t("exp.status")}</th>
                  <th className="px-4 py-3 text-end">{t("exp.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {t("table.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium">{row.entity_name}</span>
                        {row.is_sensitive ? (
                          <span className="ms-2 rounded border border-warning/40 px-1.5 py-0.5 text-[11px] text-warning-foreground">
                            {t("exp.restricted")}
                          </span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground">{row.request_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t(`exp.type.${row.expense_type}` as "exp.type.supplier")}
                      </td>
                      <td className="max-w-[22rem] truncate px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3">{row.due_date ? formatDate(row.due_date, locale) : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-end font-medium tabular-nums">
                        {formatMoney(row.amount, row.currency, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{t("exp.restrictedHelp")}</p>
    </div>
  );
}

function NewExpenseDialog({ payroll, month }: { payroll: boolean; month: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(createExpense);
  const fetchVendors = useServerFn(listVendors);
  const fetchEmployees = useServerFn(listEmployees);

  const [open, setOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseType>("supplier");
  const [vendorId, setVendorId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [accountingMonth, setAccountingMonth] = useState(month);
  const [dueDate, setDueDate] = useState("");

  const { data: vendors } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchVendors(), enabled: open });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees(),
    enabled: open && payroll,
  });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          expense_type: expenseType,
          vendor_id: vendorId || null,
          employee_id: employeeId || null,
          recipient_name: recipientName || null,
          amount: Number(amount),
          currency,
          description,
          category: category || null,
          accounting_month: accountingMonth,
          due_date: dueDate || null,
          payment_method: "bank_transfer",
          status: "draft",
        },
      }),
    onSuccess: () => {
      toast.success(t("exp.saved"));
      setOpen(false);
      setAmount("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const months = useMemo(() => recentMonths(15), []);
  const valid = Number(amount) > 0 && description.trim().length > 1 && (vendorId || employeeId || recipientName.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("exp.newExpense")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("exp.newExpense")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="e-type">{t("exp.type")}</Label>
            <select
              id="e-type"
              value={expenseType}
              onChange={(e) => setExpenseType(e.target.value as ExpenseType)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {EXPENSE_TYPES.filter(
                (v) => payroll || !["salary", "pension", "tax_deduction"].includes(v),
              ).map((v) => (
                <option key={v} value={v}>
                  {t(`exp.type.${v}` as "exp.type.supplier")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="e-vendor">{t("exp.vendor")}</Label>
            <select
              id="e-vendor"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                if (e.target.value) setEmployeeId("");
              }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {(vendors?.rows ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
          </div>

          {payroll ? (
            <div>
              <Label htmlFor="e-employee">{t("exp.employee")}</Label>
              <select
                id="e-employee"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  if (e.target.value) setVendorId("");
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {(employees?.rows ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Label htmlFor="e-recipient">{t("exp.other")}</Label>
            <Input
              id="e-recipient"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("exp.recipientHelp")}</p>
          </div>

          <div>
            <Label htmlFor="e-amount">{t("exp.amount")}</Label>
            <Input
              id="e-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="e-currency">{t("exp.currency")}</Label>
            <select
              id="e-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="e-desc">{t("exp.description")}</Label>
            <Input
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="e-month">{t("exp.month")}</Label>
            <select
              id="e-month"
              value={accountingMonth}
              onChange={(e) => setAccountingMonth(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m.slice(0, 7)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="e-due">{t("exp.dueDate")}</Label>
            <Input
              id="e-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="e-cat">{t("exp.category")}</Label>
            <select
              id="e-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {PAYMENT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          className="mt-2"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t("exp.save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
