import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { listVendors } from "@/lib/internal.functions";
import { maskEmail } from "@/lib/masking";

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors — Ledgerline" },
      { name: "description", content: "Vendor directory with payment method, location and change flags." },
      { property: "og:title", content: "Vendors — Ledgerline" },
      { property: "og:description", content: "Internal vendor directory and ledger entry point." },
    ],
  }),
  component: VendorsPage,
});

function VendorsPage() {
  const { t, locale } = useI18n();
  const fetchVendors = useServerFn(listVendors);
  const { data, isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchVendors() });
  const [query, setQuery] = useState("");

  const rows = (data?.rows ?? []).filter((v) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      v.vendor_name.toLowerCase().includes(q) ||
      v.beneficiary_name.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.vendors")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact details are masked. Banking details are never displayed in full.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("table.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("vendor.name")}</TableHead>
                  <TableHead>{t("vendor.beneficiary")}</TableHead>
                  <TableHead>{t("vendor.email")}</TableHead>
                  <TableHead>{t("vendor.country")}</TableHead>
                  <TableHead>{t("method.title")}</TableHead>
                  <TableHead className="text-end">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {v.vendor_name}
                        {v.payment_details_changed ? (
                          <AlertTriangle className="size-3.5 text-warning-foreground" />
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{v.beneficiary_name}</TableCell>
                    <TableCell className="font-mono text-xs">{maskEmail(v.email)}</TableCell>
                    <TableCell className="text-muted-foreground">{v.country ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.preferred_payment_method === "paypal"
                        ? t("method.paypal")
                        : v.preferred_payment_method === "bank_transfer"
                          ? t("method.bank")
                          : "—"}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatDate(v.created_at, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
