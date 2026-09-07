import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { listEmployees } from "@/lib/employees.functions";
import { EXPENSE_TYPES, currentMonthKey, formatMonth, recentMonths, type ExpenseType } from "@/lib/expenses";
import {
  generateRecurringMonth,
  listRecurringTemplates,
  saveRecurringTemplate,
} from "@/lib/expenses.functions";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { listVendors } from "@/lib/internal.functions";
import { PAYMENT_CATEGORIES, SORTED_CURRENCIES } from "@/lib/reference";
import { useStaffProfile } from "@/lib/staff-profile";

export const Route = createFileRoute("/_authenticated/recurring")({
  head: () => ({
    meta: [
      { title: "Recurring expenses — Ledgerline" },
      {
        name: "description",
        content: "Monthly recurring expense templates that create drafts only, on request.",
      },
      { property: "og:title", content: "Recurring expenses — Ledgerline" },
      { property: "og:description", content: "Templates generate draft expenses for a chosen month, never payments." },
    ],
  }),
  component: RecurringPage,
});

function RecurringPage() {
  const { t, locale } = useI18n();
  const { roles } = useStaffProfile();
  const payroll = roles.some((r) => ["admin", "accounting", "payment_manager"].includes(r));
  const queryClient = useQueryClient();

  const fetchTemplates = useServerFn(listRecurringTemplates);
  const generate = useServerFn(generateRecurringMonth);
  const [month, setMonth] = useState(currentMonthKey());
  const months = useMemo(() => recentMonths(15), []);

  const { data, isLoading } = useQuery({
    queryKey: ["recurring-templates"],
    queryFn: () => fetchTemplates(),
  });

  const run = useMutation({
    mutationFn: () => generate({ data: { month } }),
    onSuccess: (result) => {
      toast.success(t("exp.generateResult", { created: result.created, skipped: result.skipped }));
      void queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("exp.recurring")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("exp.recurringHelp")}</p>
        </div>
        <TemplateDialog payroll={payroll} />
      </div>

      <Card className="shadow-panel">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[14rem]">
            <Label htmlFor="gen-month">{t("exp.month")}</Label>
            <select
              id="gen-month"
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
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {t("exp.generate")}
          </Button>
          <p className="basis-full text-xs text-muted-foreground">{t("exp.generateHelp")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="m-4 h-32" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start">{t("exp.templateName")}</th>
                    <th className="px-4 py-3 text-start">{t("exp.recipient")}</th>
                    <th className="px-4 py-3 text-start">{t("exp.type")}</th>
                    <th className="px-4 py-3 text-start">{t("exp.dueDay")}</th>
                    <th className="px-4 py-3 text-end">{t("exp.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {t("table.empty")}
                      </td>
                    </tr>
                  ) : (
                    (data?.rows ?? []).map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {row.name}
                          {!row.active ? (
                            <span className="ms-2 text-xs text-muted-foreground">({t("exp.active")}: —)</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{row.entity_name}</td>
                        <td className="px-4 py-3">
                          {t(`exp.type.${row.expense_type}` as "exp.type.supplier")}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.due_day}</td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {formatMoney(row.amount, row.currency, locale)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateDialog({ payroll }: { payroll: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(saveRecurringTemplate);
  const fetchVendors = useServerFn(listVendors);
  const fetchEmployees = useServerFn(listEmployees);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("subscription");
  const [vendorId, setVendorId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [dueDay, setDueDay] = useState("1");

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
          name,
          expense_type: expenseType,
          vendor_id: vendorId || null,
          employee_id: employeeId || null,
          recipient_name: recipientName || null,
          amount: Number(amount),
          currency,
          description,
          category: category || null,
          payment_method: "bank_transfer",
          due_day: Number(dueDay) || 1,
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success(t("exp.saved"));
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid = name.trim().length > 1 && Number(amount) > 0 && description.trim().length > 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("exp.newTemplate")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("exp.newTemplate")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="tpl-name">{t("exp.templateName")}</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="tpl-type">{t("exp.type")}</Label>
            <select
              id="tpl-type"
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
            <Label htmlFor="tpl-day">{t("exp.dueDay")}</Label>
            <Input
              id="tpl-day"
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="tpl-vendor">{t("exp.vendor")}</Label>
            <select
              id="tpl-vendor"
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
              <Label htmlFor="tpl-employee">{t("exp.employee")}</Label>
              <select
                id="tpl-employee"
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
            <Label htmlFor="tpl-recipient">{t("exp.other")}</Label>
            <Input
              id="tpl-recipient"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="tpl-amount">{t("exp.amount")}</Label>
            <Input
              id="tpl-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="tpl-currency">{t("exp.currency")}</Label>
            <select
              id="tpl-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tpl-desc">{t("exp.description")}</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tpl-cat">{t("exp.category")}</Label>
            <select
              id="tpl-cat"
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
        <Button className="mt-2" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {t("exp.save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
