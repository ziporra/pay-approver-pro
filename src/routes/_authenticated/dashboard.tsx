import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, FileWarning, Wallet } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney, dueUrgency } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { listPaymentRequests } from "@/lib/internal.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ledgerline" },
      { name: "description", content: "Overview of pending approvals, payments due and missing invoices." },
      { property: "og:title", content: "Dashboard — Ledgerline" },
      { property: "og:description", content: "Company-wide view of vendor payment activity." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t, locale } = useI18n();
  const fetchRequests = useServerFn(listPaymentRequests);
  const { data, isLoading } = useQuery({
    queryKey: ["payment-requests"],
    queryFn: () => fetchRequests(),
  });

  const rows = data?.rows ?? [];
  const awaitingApproval = rows.filter((r) => r.status === "awaiting_approval");
  const awaitingPayment = rows.filter((r) => r.status === "awaiting_payment");
  const missingInvoices = rows.filter((r) => r.invoice_status !== "attached");
  const overdue = rows.filter((r) => {
    const u = dueUrgency(r.due_date);
    return u?.tone === "overdue" && !["paid", "completed", "cancelled"].includes(r.status);
  });

  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    if (["rejected", "cancelled"].includes(r.status)) continue;
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + Number(r.amount));
  }

  const cards = [
    { label: t("dash.awaitingApproval"), value: awaitingApproval.length, icon: Clock },
    { label: t("dash.awaitingPayment"), value: awaitingPayment.length, icon: Wallet },
    { label: t("dash.missingInvoices"), value: missingInvoices.length, icon: FileWarning },
    { label: t("dash.overdue"), value: overdue.length, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.dashboard")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dash.noMixing")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-panel">
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                  {isLoading ? <Skeleton className="h-8 w-10" /> : c.value}
                </p>
              </div>
              <c.icon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="shadow-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("dash.awaitingApproval")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : awaitingApproval.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("table.empty")}</p>
            ) : (
              awaitingApproval.slice(0, 8).map((r) => (
                <Link
                  key={r.id}
                  to="/payments"
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {r.vendors?.vendor_name ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.request_number} · {formatDate(r.created_at, locale)}
                    </span>
                  </span>
                  <span className="ms-4 shrink-0 text-end">
                    <span className="block font-medium tabular-nums">
                      {formatMoney(r.amount, r.currency, locale)}
                    </span>
                    {r.possible_duplicate ? (
                      <span className="text-xs text-warning-foreground">Possible duplicate</span>
                    ) : null}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("dash.byCurrency")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byCurrency.size === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("table.empty")}</p>
            ) : (
              [...byCurrency.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([code, total]) => (
                  <div
                    key={code}
                    className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium">{code}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(total, code, locale)}
                    </span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("dash.missingInvoices")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {missingInvoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("table.empty")}</p>
          ) : (
            missingInvoices.slice(0, 6).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
              >
                <span className="font-medium">{r.vendors?.vendor_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{r.request_number}</span>
                <StatusBadge status={r.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
