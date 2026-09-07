import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { getEmployeeLedger, listEmployees, saveEmployee } from "@/lib/employees.functions";
import { useI18n } from "@/lib/i18n";
import { SORTED_CURRENCIES } from "@/lib/reference";
import { useStaffProfile } from "@/lib/staff-profile";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employees — Ledgerline" },
      { name: "description", content: "Employee profiles and personal expense ledgers, restricted to authorised staff." },
      { property: "og:title", content: "Employees — Ledgerline" },
      { property: "og:description", content: "Restricted employee directory and per-employee ledgers." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { t } = useI18n();
  const { roles } = useStaffProfile();
  const allowed = roles.some((r) => ["admin", "accounting", "payment_manager"].includes(r));
  const fetchEmployees = useServerFn(listEmployees);

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees(),
    enabled: allowed,
    retry: false,
  });

  const [selected, setSelected] = useState<string | null>(null);

  if (!allowed) {
    return (
      <Card className="shadow-panel">
        <CardContent className="py-10 text-center text-sm text-destructive">{t("exp.noAccess")}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("exp.employees")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("exp.employeesHelp")}</p>
        </div>
        <NewEmployeeDialog />
      </div>

      {error ? <p className="text-sm text-destructive">{t("exp.noAccess")}</p> : null}

      <Card className="shadow-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="m-4 h-32" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start">{t("exp.fullName")}</th>
                    <th className="px-4 py-3 text-start">{t("exp.department")}</th>
                    <th className="px-4 py-3 text-start">{t("exp.jobTitle")}</th>
                    <th className="px-4 py-3 text-start">{t("exp.account")}</th>
                    <th className="px-4 py-3 text-end">{t("exp.ledger")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {t("exp.noEmployees")}
                      </td>
                    </tr>
                  ) : (
                    (data?.rows ?? []).map((e) => (
                      <tr key={e.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-medium">{e.full_name}</span>
                          {!e.payout_ready ? (
                            <span className="ms-2 rounded border border-destructive/50 px-1.5 py-0.5 text-[11px] text-destructive">
                              {t("exp.payoutMissing")}
                            </span>
                          ) : null}
                          <span className="block text-xs text-muted-foreground">{e.employee_number ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3">{e.department ?? "—"}</td>
                        <td className="px-4 py-3">{e.job_title ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{e.masked_account}</td>
                        <td className="px-4 py-3 text-end">
                          <Button variant="ghost" size="sm" onClick={() => setSelected(e.id)}>
                            {t("exp.ledger")}
                          </Button>
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

      {selected ? <LedgerDialog employeeId={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function LedgerDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const fetchLedger = useServerFn(getEmployeeLedger);
  const { data } = useQuery({
    queryKey: ["employee-ledger", employeeId],
    queryFn: () => fetchLedger({ data: { employeeId } }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {data?.employee.full_name ?? t("common.loading")} · {t("exp.ledger")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(data?.totals ?? []).map((total) => (
            <div key={total.currency} className="flex justify-between rounded-md bg-surface px-3 py-2 text-sm">
              <span className="font-medium">{total.currency}</span>
              <span className="tabular-nums text-muted-foreground">
                {t("exp.planned")}: {formatMoney(total.planned, total.currency, locale)} · {t("exp.paid")}:{" "}
                {formatMoney(total.paid, total.currency, locale)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {(data?.rows ?? []).map((row) => (
            <div key={row.id} className="flex justify-between border-b border-border/60 py-2 text-sm">
              <span>
                <span className="font-medium">{row.accounting_month?.slice(0, 7)}</span> ·{" "}
                {t(`exp.type.${row.expense_type}` as "exp.type.supplier")}
                <span className="block text-xs text-muted-foreground">{row.description}</span>
              </span>
              <span className="tabular-nums">{formatMoney(row.amount, row.currency, locale)}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewEmployeeDialog() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(saveEmployee);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    employee_number: "",
    email: "",
    department: "",
    job_title: "",
    country: "",
    start_date: "",
    default_currency: "",
    bank_name: "",
    iban: "",
    account_number: "",
    branch_number: "",
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => save({ data: { ...form, payment_method: "bank_transfer" } }),
    onSuccess: () => {
      toast.success(t("exp.saved"));
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("exp.newEmployee")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("exp.newEmployee")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="emp-name">{t("exp.fullName")}</Label>
            <Input id="emp-name" value={form.full_name} onChange={set("full_name")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-num">{t("exp.employeeNumber")}</Label>
            <Input id="emp-num" value={form.employee_number} onChange={set("employee_number")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-email">{t("vendor.email")}</Label>
            <Input id="emp-email" value={form.email} onChange={set("email")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-dep">{t("exp.department")}</Label>
            <Input id="emp-dep" value={form.department} onChange={set("department")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-job">{t("exp.jobTitle")}</Label>
            <Input id="emp-job" value={form.job_title} onChange={set("job_title")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-country">{t("exp.country")}</Label>
            <Input id="emp-country" value={form.country} onChange={set("country")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-start">{t("exp.startDate")}</Label>
            <Input id="emp-start" type="date" value={form.start_date} onChange={set("start_date")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-cur">{t("exp.currency")}</Label>
            <select
              id="emp-cur"
              value={form.default_currency}
              onChange={set("default_currency")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("exp.selectCurrency")}</option>
              {SORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="emp-bank">{t("bank.bankName")}</Label>
            <Input id="emp-bank" value={form.bank_name} onChange={set("bank_name")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-iban">{t("bank.iban")}</Label>
            <Input id="emp-iban" value={form.iban} onChange={set("iban")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-acc">{t("bank.account")}</Label>
            <Input id="emp-acc" value={form.account_number} onChange={set("account_number")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="emp-branch">{t("bank.branch")}</Label>
            <Input id="emp-branch" value={form.branch_number} onChange={set("branch_number")} className="mt-1" />
          </div>
        </div>
        <Button
          className="mt-2"
          disabled={form.full_name.trim().length < 2 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t("exp.save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
