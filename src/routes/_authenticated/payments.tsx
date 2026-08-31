import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, Search } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { dueUrgency, formatDate, formatMoney, STATUS_LABELS } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { decidePaymentRequest, listPaymentRequests } from "@/lib/internal.functions";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Ledgerline" },
      { name: "description", content: "Every vendor payment request with status, due date and approval actions." },
      { property: "og:title", content: "Payments — Ledgerline" },
      { property: "og:description", content: "Central queue for approving, paying and closing vendor requests." },
    ],
  }),
  component: PaymentsPage,
});

type Action = "approve" | "reject" | "mark_paid" | "invoice_received" | "cancel";

function PaymentsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(listPaymentRequests);
  const decide = useServerFn(decidePaymentRequest);

  const { data, isLoading } = useQuery({
    queryKey: ["payment-requests"],
    queryFn: () => fetchRequests(),
  });

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState<{ id: string; action: Action; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: { requestId: string; action: Action; note: string; reference: string }) =>
      decide({
        data: {
          requestId: vars.requestId,
          action: vars.action,
          note: vars.note || null,
          reference: vars.reference || null,
        },
      }),
    onSuccess: (res) => {
      toast.success(`${res.requestNumber} → ${STATUS_LABELS[res.status] ?? res.status}`);
      setPending(null);
      setNote("");
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("common.error")),
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.request_number.toLowerCase().includes(q) ||
        (r.vendors?.vendor_name ?? "").toLowerCase().includes(q) ||
        (r.invoice_number ?? "").toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [data, query, status]);

  function exportCsv() {
    const header = [
      "Request",
      "Vendor",
      "Amount",
      "Currency",
      "Category",
      "Requested",
      "Due",
      "Status",
      "Invoice",
    ];
    const lines = rows.map((r) =>
      [
        r.request_number,
        r.vendors?.vendor_name ?? "",
        r.amount,
        r.currency,
        r.category ?? "",
        r.created_at.slice(0, 10),
        r.due_date ?? "",
        r.status,
        r.invoice_status,
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function actionsFor(row: (typeof rows)[number]) {
    const actions: { action: Action; label: string; variant?: "outline" | "destructive" }[] = [];
    if (row.status === "awaiting_approval") {
      actions.push({ action: "approve", label: "Approve" });
      actions.push({ action: "reject", label: "Reject", variant: "destructive" });
    }
    if (row.status === "awaiting_payment") {
      actions.push({ action: "mark_paid", label: "Mark paid" });
    }
    if (row.status === "awaiting_invoice") {
      actions.push({ action: "invoice_received", label: "Invoice received" });
    }
    return actions;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.payments")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("dash.noMixing")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t("table.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="size-4" />
            {t("table.export")}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden shadow-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("table.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.requestId")}</TableHead>
                    <TableHead>{t("table.vendor")}</TableHead>
                    <TableHead className="text-end">{t("table.amount")}</TableHead>
                    <TableHead>{t("table.requestDate")}</TableHead>
                    <TableHead>{t("table.dueDate")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead className="text-end">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const urgency = dueUrgency(r.due_date);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to="/payments/$id"
                            params={{ id: r.id }}
                            className="flex items-center gap-1.5 underline-offset-4 hover:underline"
                          >
                            {r.request_number}
                            {r.possible_duplicate ? (
                              <AlertTriangle className="size-3.5 text-warning-foreground" />
                            ) : null}
                          </Link>
                        </TableCell>

                        <TableCell className="font-medium">
                          {r.vendors?.vendor_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatMoney(r.amount, r.currency, locale)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(r.created_at, locale)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              urgency?.tone === "overdue"
                                ? "text-destructive"
                                : urgency?.tone === "today" || urgency?.tone === "soon"
                                  ? "text-warning-foreground"
                                  : "text-muted-foreground"
                            }
                          >
                            {formatDate(r.due_date, locale)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-end">
                          <span className="flex justify-end gap-2">
                            {actionsFor(r).map((a) => (
                              <Button
                                key={a.action}
                                size="sm"
                                variant={a.variant ?? "outline"}
                                onClick={() =>
                                  setPending({ id: r.id, action: a.action, label: a.label })
                                }
                              >
                                {a.label}
                              </Button>
                            ))}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.label}</DialogTitle>
            <DialogDescription>
              {pending?.action === "reject"
                ? "A reason is required and will be stored with the request."
                : "This decision is recorded with your name and the time."}
            </DialogDescription>
          </DialogHeader>
          {pending?.action === "mark_paid" ? (
            <Input
              placeholder="Payment reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          ) : null}
          <Textarea
            rows={3}
            placeholder={pending?.action === "reject" ? "Reason for rejection" : "Note (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                pending &&
                mutation.mutate({
                  requestId: pending.id,
                  action: pending.action,
                  note,
                  reference,
                })
              }
            >
              {pending?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
