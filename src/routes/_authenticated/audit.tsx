import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Lock, RefreshCw } from "lucide-react";
import { useState } from "react";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { displayNameFor } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n";
import { listAuditLog, listStaff } from "@/lib/staff.functions";
import { listMondaySyncLogs, retryMondaySyncs } from "@/lib/monday.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Ledgerline" },
      {
        name: "description",
        content: "Immutable record of every internal action on vendors and payment requests.",
      },
      { property: "og:title", content: "Audit log — Ledgerline" },
      { property: "og:description", content: "Administrator view of all internal activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

const STATUSES = [
  "submitted",
  "awaiting_approval",
  "approved",
  "rejected",
  "awaiting_payment",
  "paid",
  "awaiting_invoice",
  "completed",
  "cancelled",
];

function AuditPage() {
  const { t, locale } = useI18n();
  const [actorId, setActorId] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [documentsOnly, setDocumentsOnly] = useState(false);

  const staffQuery = useQuery({ queryKey: ["staff", "list"], queryFn: () => listStaff() });

  const filters = {
    actorId: actorId === "all" ? null : actorId,
    status: status === "all" ? null : status,
    from: from || null,
    to: to || null,
    documentsOnly,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => listAuditLog({ data: filters }),
  });

  const staffById = new Map((staffQuery.data?.staff ?? []).map((s) => [s.id, s]));

  function exportCsv() {
    const rows = data?.rows ?? [];
    const header = ["When", "Who", "Email", "Role", "Action", "From", "To", "Field", "Old", "New"];
    const body = rows.map((r) => [
      r.occurred_at,
      r.actor_label ?? "",
      r.actor_email ?? "",
      r.actor_role ?? "",
      r.action,
      r.previous_status ?? "",
      r.new_status ?? "",
      r.field ?? "",
      r.old_value_masked ?? "",
      r.new_value_masked ?? "",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (data?.forbidden) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Lock className="size-5" />
          {t("audit.adminOnly")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("audit.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("audit.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={exportCsv} className="gap-2">
          <Download className="size-4" />
          {t("table.export")}
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("audit.filter.all")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label>{t("audit.filter.staff")}</Label>
            <Select value={actorId} onValueChange={setActorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.filter.all")}</SelectItem>
                {(staffQuery.data?.staff ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {displayNameFor(person.display_name ?? person.full_name, person.email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("audit.filter.status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.filter.all")}</SelectItem>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`status.${value}` as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">{t("audit.filter.from")}</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">{t("audit.filter.to")}</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="docs"
                checked={documentsOnly}
                onCheckedChange={setDocumentsOnly}
              />
              <Label htmlFor="docs">{t("audit.filter.documents")}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (data?.rows ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("audit.empty")}</p>
          ) : (
            <div className="divide-y divide-border/60">
              {(data?.rows ?? []).map((row) => {
                const actor = row.actor_id ? staffById.get(row.actor_id) : undefined;
                const name = displayNameFor(
                  actor?.display_name ?? row.actor_label,
                  row.actor_email,
                );
                return (
                  <div key={row.id} className="flex items-start gap-3 px-5 py-3">
                    <UserAvatar
                      id={row.actor_id}
                      name={name}
                      email={row.actor_email}
                      imageUrl={null}
                      color={actor?.avatar_color}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground">{row.actor_email}</span>
                        {row.actor_role ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {row.actor_role}
                          </span>
                        ) : null}
                        <span className="ms-auto text-xs tabular-nums text-muted-foreground">
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(row.occurred_at))}
                        </span>
                      </div>
                      <p className="text-sm">{row.action.replaceAll("_", " ")}</p>
                      {row.previous_status || row.new_status ? (
                        <p className="text-xs text-muted-foreground">
                          {row.previous_status ?? "—"} → {row.new_status ?? "—"}
                        </p>
                      ) : null}
                      {row.field ? (
                        <p className="text-xs text-muted-foreground">
                          {row.field}: {row.old_value_masked ?? "—"} → {row.new_value_masked ?? "—"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <MondaySyncCard />
      <p className="text-xs text-muted-foreground">{t("audit.immutable")}</p>
    </div>
  );

}

/** Monday.com mirror health: recent operations and an admin retry control. */
function MondaySyncCard() {
  const queryClient = useQueryClient();
  const logs = useQuery({ queryKey: ["monday", "logs"], queryFn: () => listMondaySyncLogs() });
  const retry = useMutation({
    mutationFn: () => retryMondaySyncs({ data: {} }),
    onSuccess: (result) => {
      toast.success(`Retried ${result.processed} — ${result.succeeded} synced, ${result.failed} still failing.`);
      void queryClient.invalidateQueries({ queryKey: ["monday", "logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = logs.data?.rows ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Monday.com sync</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Payments mirror to the Payments board and vendors to Contacts. No banking credentials are sent —
            account identifiers are masked to the last four characters.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => retry.mutate()}
          disabled={retry.isPending}
        >
          <RefreshCw className={retry.isPending ? "size-4 animate-spin" : "size-4"} />
          Retry pending
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground">
            Pending: <span className="font-medium text-foreground">{pending}</span>
          </span>
          <span className="text-muted-foreground">
            Failed: <span className="font-medium text-foreground">{failed}</span>
          </span>
          <span className="text-muted-foreground">
            Recent operations: <span className="font-medium text-foreground">{rows.length}</span>
          </span>
        </div>
        <div className="divide-y rounded-md border">
          {rows.slice(0, 10).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {row.action} · {row.entity_type}
                </p>
                {row.error ? (
                  <p className="truncate text-xs text-destructive">{row.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {row.monday_item_id ? `Monday item ${row.monday_item_id}` : "—"}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.status} · {row.attempts} attempt(s)
              </span>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No synchronizations recorded yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
