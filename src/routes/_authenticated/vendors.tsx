import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { MondayVendorImport } from "@/components/MondayVendorImport";
import { NewRequestFromInvoice } from "@/components/NewRequestFromInvoice";
import { NewVendorDialog } from "@/components/NewVendorDialog";
import { VENDOR_FIELD_LABEL_KEYS } from "@/lib/vendor-completeness";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getMyAccess, listVendors } from "@/lib/internal.functions";
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

/** Stable colour per label, so a country or category always looks the same. */
const TONES = [
  "bg-primary/10 text-primary",
  "bg-success/15 text-success-foreground",
  "bg-warning/20 text-warning-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-destructive/10 text-destructive",
];
function tone(label: string) {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return TONES[hash % TONES.length];
}

function VendorsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const fetchVendors = useServerFn(listVendors);
  const fetchAccess = useServerFn(getMyAccess);
  const { data, isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchVendors() });
  const { data: access } = useQuery({ queryKey: ["my-access"], queryFn: () => fetchAccess() });
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [category, setCategory] = useState("all");

  const all = data?.rows ?? [];
  const countries = useMemo(
    () => Array.from(new Set(all.map((v) => v.country).filter(Boolean) as string[])).sort(),
    [all],
  );
  const categories = useMemo(
    () => Array.from(new Set(all.map((v) => v.category).filter(Boolean) as string[])).sort(),
    [all],
  );

  const rows = all.filter((v) => {
    if (country !== "all" && v.country !== country) return false;
    if (category !== "all" && v.category !== category) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      v.vendor_name.toLowerCase().includes(q) ||
      (v.beneficiary_name ?? "").toLowerCase().includes(q) ||
      (v.email ?? "").toLowerCase().includes(q)
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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t("table.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("vp.filterCountry")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("vp.allCountries")}</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("vp.filterCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("vp.allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NewRequestFromInvoice
            prominent
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["vendors"] });
              queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
            }}
          />
          <NewVendorDialog />
        </div>
      </div>

      {access?.roles.includes("admin") ? <MondayVendorImport /> : null}

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
                    <TableHead>{t("vendor.name")}</TableHead>
                    <TableHead>{t("vp.filterCategory")}</TableHead>
                    <TableHead>{t("vendor.email")}</TableHead>
                    <TableHead>{t("vendor.country")}</TableHead>
                    <TableHead>{t("method.title")}</TableHead>
                    <TableHead className="text-end">Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((v) => (
                    <TableRow
                      key={v.id}
                      className={v.profile_complete ? undefined : "bg-destructive/5"}
                    >
                      <TableCell className="font-medium">
                        <Link
                          to="/vendors/$id"
                          params={{ id: v.id }}
                          className="flex flex-wrap items-center gap-2 underline-offset-4 hover:underline"
                        >
                          {v.vendor_name}
                          {v.payment_details_changed ? (
                            <AlertTriangle className="size-3.5 text-warning-foreground" />
                          ) : null}
                          {v.needs_review ? (
                            <Badge className="bg-warning/20 text-[10px] text-warning-foreground">
                              {t("vp.needsReview")}
                            </Badge>
                          ) : null}
                          {v.profile_complete ? null : (
                            <span className="rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                              {t("vp.incomplete")}
                            </span>
                          )}
                        </Link>
                        {v.profile_complete ? null : (
                          <p className="mt-1 text-[11px] text-destructive">
                            {t("vp.missingList", {
                              fields: v.missing_fields
                                .map((f: string) =>
                                  t((VENDOR_FIELD_LABEL_KEYS[f] ?? f) as Parameters<typeof t>[0]),
                                )
                                .join(", "),
                            })}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        {v.category ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone(v.category)}`}
                          >
                            {v.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{maskEmail(v.email)}</TableCell>
                      <TableCell>
                        {v.country ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone(v.country)}`}
                          >
                            {v.country}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
