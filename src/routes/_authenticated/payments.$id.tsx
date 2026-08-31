import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getPaymentRequestDetail } from "@/lib/internal.functions";

export const Route = createFileRoute("/_authenticated/payments/$id")({
  head: () => ({
    meta: [
      { title: "Payment request — Ledgerline" },
      { name: "description", content: "Payment request details, documents and activity timeline." },
      { property: "og:title", content: "Payment request — Ledgerline" },
      { property: "og:description", content: "Full history of a vendor payment request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentDetailPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function PaymentDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ["payment", id],
    queryFn: () => getPaymentRequestDetail({ data: { requestId: id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (error || !data)
    return <p className="text-sm text-destructive">{t("common.error")}</p>;

  const r = data.request;
  const vendor = r.vendors as { vendor_name: string; email: string } | null;

  return (
    <div className="space-y-6">
      <Link
        to="/payments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("nav.payments")}
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{r.request_number}</h1>
        <StatusBadge status={r.status} />
        <span className="ms-auto text-lg font-semibold tabular-nums">
          {formatMoney(r.amount, r.currency, locale)}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("wizard.step4")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Row label={t("table.vendor")} value={vendor?.vendor_name ?? "—"} />
                <Row label={t("vendor.email")} value={vendor?.email ?? "—"} />
                <Row label={t("request.description")} value={r.description} />
                <Row label={t("request.category")} value={r.category ?? "—"} />
                <Row label={t("request.invoiceNumber")} value={r.invoice_number ?? "—"} />
                <Row label={t("request.po")} value={r.po_reference ?? "—"} />
                <Row label={t("table.requestDate")} value={formatDate(r.created_at, locale)} />
                <Row label={t("table.dueDate")} value={formatDate(r.due_date, locale)} />
                <Row label={t("table.invoice")} value={t(`invoice.${r.invoice_status}` as never)} />
                <Row label={t("method.title")} value={t(`method.${r.payment_method === "paypal" ? "paypal" : "bank"}` as never)} />
              </dl>
              {r.notes ? (
                <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm">{r.notes}</p>
              ) : null}
              {r.rejection_reason ? (
                <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {r.rejection_reason}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("docs.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
              ) : (
                data.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="truncate">{doc.file_name}</span>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {formatDate(doc.created_at, locale)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("activity.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline requestId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
