import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/wizard/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { saveVendorProfile } from "@/lib/internal.functions";
import { getVendorProfile, uploadRequestDocument } from "@/lib/vendor-profile.functions";
import { VENDOR_FIELD_LABEL_KEYS } from "@/lib/vendor-completeness";

export const Route = createFileRoute("/_authenticated/vendors/$id")({
  head: () => ({
    meta: [
      { title: "Supplier profile — Ledgerline" },
      { name: "description", content: "Supplier details, ledger totals, linked requests and documents." },
      { property: "og:title", content: "Supplier profile — Ledgerline" },
      { property: "og:description", content: "Supplier card with ledger and document history." },
    ],
  }),
  component: VendorProfilePage,
});

type Editable = {
  vendor_name: string;
  beneficiary_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  tax_id: string;
  registration_number: string;
};

function VendorProfilePage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const load = useServerFn(getVendorProfile);
  const save = useServerFn(saveVendorProfile);
  const upload = useServerFn(uploadRequestDocument);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-profile", id],
    queryFn: () => load({ data: { vendorId: id } }),
  });

  const [form, setForm] = useState<Editable | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.vendor || form) return;
    const v = data.vendor;
    setForm({
      vendor_name: v.vendor_name ?? "",
      beneficiary_name: v.beneficiary_name ?? "",
      email: v.email ?? "",
      phone: v.phone ?? "",
      country: v.country ?? "",
      city: v.city ?? "",
      tax_id: v.tax_id ?? "",
      registration_number: v.registration_number ?? "",
    });
  }, [data, form]);

  async function handleSave() {
    if (!form) return;
    setBusy(true);
    try {
      await save({ data: { id, ...form } });
      toast.success(t("vp.saveDetails"));
      queryClient.invalidateQueries({ queryKey: ["vendor-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    if (!uploadFor) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
    try {
      await upload({
        data: { requestId: uploadFor, fileName: file.name, dataUrl, docType: "receipt" },
      });
      toast.success(t("vp.uploadDoc"));
      queryClient.invalidateQueries({ queryKey: ["vendor-profile", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setUploadFor(null);
    }
  }

  if (isLoading || !data || !form) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { vendor, payout, totals, requests, documents, missing } = data;
  const docsByRequest = new Map<string, typeof documents>();
  for (const doc of documents) {
    const list = docsByRequest.get(doc.payment_request_id) ?? [];
    list.push(doc);
    docsByRequest.set(doc.payment_request_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/vendors"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            {t("nav.vendors")}
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{vendor.vendor_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {vendor.category ? <Badge variant="secondary">{vendor.category}</Badge> : null}
            {vendor.country ? <Badge variant="outline">{vendor.country}</Badge> : null}
            {vendor.needs_review ? (
              <Badge className="bg-warning/20 text-warning-foreground">{t("vp.needsReview")}</Badge>
            ) : null}
            {missing.length > 0 ? (
              <Badge variant="destructive">
                {t("vp.missingList", {
                  fields: missing
                    .map((f: string) => t((VENDOR_FIELD_LABEL_KEYS[f] ?? f) as Parameters<typeof t>[0]))
                    .join(", "),
                })}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="text-end text-xs text-muted-foreground">
          <p className="flex items-center justify-end gap-1">
            <RefreshCw className="size-3.5" />
            {t("vp.syncStatus")}:{" "}
            {vendor.monday_contact_id ? `#${vendor.monday_contact_id}` : "—"}
          </p>
          <p>{vendor.monday_synced_at ? formatDate(vendor.monday_synced_at, locale) : "—"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">{t("vp.editDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["vendor_name", "vendor.name"],
                ["beneficiary_name", "vendor.beneficiary"],
                ["email", "vendor.email"],
                ["phone", "vendor.phone"],
                ["country", "vendor.country"],
                ["city", "vendor.city"],
                ["tax_id", "vendor.taxId"],
                ["registration_number", "vendor.registration"],
              ] as [keyof Editable, string][]
            ).map(([key, labelKey]) => (
              <TextField
                key={key}
                id={`vp-${key}`}
                label={t(labelKey as Parameters<typeof t>[0])}
                value={form[key]}
                onChange={(v) => setForm({ ...form, [key]: v })}
              />
            ))}
            <div className="sm:col-span-2">
              <Button onClick={handleSave} disabled={busy}>
                {t("vp.saveDetails")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">{t("vp.ledger")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.keys(totals).length === 0 ? (
              <p className="text-muted-foreground">{t("vp.noRequests")}</p>
            ) : (
              Object.entries(totals).map(([currency, value]) => (
                <div key={currency} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">{currency}</p>
                  <p className="mt-1 flex justify-between">
                    <span>{t("vp.paidTotal")}</span>
                    <span className="tabular-nums">{formatMoney(value.paid, currency, locale)}</span>
                  </p>
                  <p className="flex justify-between text-warning-foreground">
                    <span>{t("vp.outstandingTotal")}</span>
                    <span className="tabular-nums">
                      {formatMoney(value.outstanding, currency, locale)}
                    </span>
                  </p>
                </div>
              ))
            )}
            {payout ? (
              <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{t("exp.paymentDetails")}</p>
                <p>{payout.method === "paypal" ? t("method.paypal") : t("method.bank")}</p>
                {payout.method === "paypal" ? (
                  <p className="font-mono">{payout.paypal_email ?? "—"}</p>
                ) : (
                  <>
                    <p>{payout.bank_name ?? "—"}</p>
                    <p className="font-mono">{payout.iban}</p>
                    <p className="font-mono">{payout.account_number}</p>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-panel">
        <CardHeader>
          <CardTitle className="text-base">{t("vp.documents")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("vp.noRequests")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.requestId")}</TableHead>
                    <TableHead className="text-end">{t("table.amount")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead>{t("table.dueDate")}</TableHead>
                    <TableHead>{t("vp.documents")}</TableHead>
                    <TableHead className="text-end">{t("vp.uploadDoc")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          to="/payments/$id"
                          params={{ id: r.id }}
                          className="underline-offset-4 hover:underline"
                        >
                          {r.request_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMoney(r.amount, r.currency, locale)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(r.due_date, locale)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(docsByRequest.get(r.id) ?? []).map((d) => (
                          <span key={d.id} className="me-2 inline-block">
                            {d.doc_type}
                          </span>
                        ))}
                        {(docsByRequest.get(r.id) ?? []).length === 0 ? "—" : null}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setUploadFor(r.id);
                            fileInput.current?.click();
                          }}
                        >
                          <FileUp className="size-3.5" />
                          {t("vp.uploadDoc")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
