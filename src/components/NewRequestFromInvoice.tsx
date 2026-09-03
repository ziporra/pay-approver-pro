import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { InvoiceAiUpload, type PickedFile } from "@/components/InvoiceAiUpload";
import { TextField } from "@/components/wizard/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { extractInvoiceStaff } from "@/lib/invoice-ai.functions";
import type { ExtractedInvoice } from "@/lib/invoice-ai.server";
import { matchVendorsFromInvoice, type VendorMatch } from "@/lib/internal.functions";
import { isValidEmail, SORTED_CURRENCIES } from "@/lib/reference";
import { submitPaymentRequest } from "@/lib/vendor-portal.functions";
import { missingVendorFields, VENDOR_FIELD_LABEL_KEYS } from "@/lib/vendor-completeness";

type Draft = {
  vendor_name: string;
  beneficiary_name: string;
  email: string;
  country: string;
  tax_id: string;
  amount: string;
  currency: string;
  description: string;
  invoice_number: string;
  due_date: string;
  method: "paypal" | "bank_transfer";
  paypal_email: string;
  bank_name: string;
  bank_country: string;
  swift_bic: string;
  iban: string;
  account_number: string;
};

const emptyDraft: Draft = {
  vendor_name: "",
  beneficiary_name: "",
  email: "",
  country: "",
  tax_id: "",
  amount: "",
  currency: "USD",
  description: "",
  invoice_number: "",
  due_date: "",
  method: "bank_transfer",
  paypal_email: "",
  bank_name: "",
  bank_country: "",
  swift_bic: "",
  iban: "",
  account_number: "",
};

export function NewRequestFromInvoice({ onCreated }: { onCreated: () => void }) {
  const { t } = useI18n();
  const extract = useServerFn(extractInvoiceStaff);
  const matchVendors = useServerFn(matchVendorsFromInvoice);
  const submit = useServerFn(submitPaymentRequest);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [matches, setMatches] = useState<VendorMatch[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [bankFromAi, setBankFromAi] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const missing = missingVendorFields(draft);
  const vendorComplete = missing.length === 0;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setStep(0);
    setDraft(emptyDraft);
    setFile(null);
    setMatches([]);
    setVendorId(null);
    setBankFromAi(false);
    setVerified(false);
    setErrors({});
  }

  function missingLabel(fields: string[]) {
    return t("vp.missingList", {
      fields: fields.map((f) => t(VENDOR_FIELD_LABEL_KEYS[f] ?? f)).join(", "),
    });
  }

  async function applyExtraction(fields: ExtractedInvoice, filled: string[], picked: PickedFile) {
    setFile(picked);
    setDraft((prev) => ({
      ...prev,
      vendor_name: fields.vendor_name ?? prev.vendor_name,
      beneficiary_name: fields.beneficiary_name ?? fields.vendor_name ?? prev.beneficiary_name,
      email: fields.email ?? prev.email,
      country: fields.country ?? prev.country,
      tax_id: fields.tax_id ?? prev.tax_id,
      amount: fields.amount ?? prev.amount,
      currency:
        fields.currency && SORTED_CURRENCIES.some((c) => c.code === fields.currency)
          ? fields.currency
          : prev.currency,
      description: fields.description ?? prev.description,
      invoice_number: fields.invoice_number ?? prev.invoice_number,
      due_date:
        fields.due_date && /^\d{4}-\d{2}-\d{2}$/.test(fields.due_date) ? fields.due_date : prev.due_date,
      method: fields.method ?? (fields.paypal_email ? "paypal" : prev.method),
      paypal_email: fields.paypal_email ?? prev.paypal_email,
      bank_name: fields.bank_name ?? prev.bank_name,
      bank_country: fields.bank_country ?? prev.bank_country,
      swift_bic: fields.swift_bic ?? prev.swift_bic,
      iban: fields.iban ?? prev.iban,
      account_number: fields.account_number ?? prev.account_number,
    }));
    setBankFromAi(
      Boolean(fields.iban || fields.account_number || fields.swift_bic || fields.paypal_email),
    );
    setVerified(false);
    setVendorId(null);
    toast.success(t("ai.filledCount", { count: filled.length }));

    try {
      const res = await matchVendors({
        data: {
          vendor_name: fields.vendor_name,
          beneficiary_name: fields.beneficiary_name,
          email: fields.email,
          tax_id: fields.tax_id,
          registration_number: fields.registration_number,
        },
      });
      setMatches(res.matches);
    } catch {
      setMatches([]);
    }
    setStep(1);
  }

  function useVendor(match: VendorMatch) {
    setVendorId(match.id);
    setDraft((prev) => ({
      ...prev,
      vendor_name: match.profile.vendor_name,
      beneficiary_name: match.profile.beneficiary_name,
      email: match.profile.email,
      country: match.profile.country ?? prev.country,
      tax_id: match.taxId ?? prev.tax_id,
      method: match.profile.method ?? prev.method,
      paypal_email: match.profile.paypal_email ?? prev.paypal_email,
      bank_name: match.profile.bank_name ?? prev.bank_name,
      bank_country: match.profile.bank_country ?? prev.bank_country,
      swift_bic: match.profile.swift_bic ?? prev.swift_bic,
      iban: match.profile.iban ?? prev.iban,
      account_number: match.profile.account_number ?? prev.account_number,
    }));
    setBankFromAi(false);
    setErrors({});
  }

  function goToRequest() {
    if (!vendorComplete) {
      setErrors({ vendor: t("vp.blocked") });
      return;
    }
    if (bankFromAi && !verified) {
      setErrors({ verified: t("ai.bankWarning") });
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function handleSubmit() {
    const next: Record<string, string> = {};
    if (!vendorComplete) next["vendor"] = t("vp.blocked");
    if (!(Number(draft.amount) > 0)) next["amount"] = t("common.required");
    if (draft.description.trim().length < 3) next["description"] = t("common.required");
    if (!file) next["file"] = t("docs.help");
    if (bankFromAi && !verified) next["verified"] = t("ai.bankWarning");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const res = await submit({
        data: {
          vendorId,
          vendor: {
            vendor_name: draft.vendor_name.trim(),
            beneficiary_name: draft.beneficiary_name.trim(),
            email: draft.email.trim(),
            country: draft.country || null,
            tax_id: draft.tax_id || null,
          },
          payment: {
            method: draft.method,
            paypal_email: draft.paypal_email || null,
            beneficiary_name: draft.beneficiary_name.trim(),
            bank_name: draft.bank_name || null,
            bank_country: draft.bank_country || null,
            swift_bic: draft.swift_bic || null,
            iban: draft.iban || null,
            account_number: draft.account_number || null,
          },
          request: {
            amount: Number(draft.amount),
            currency: draft.currency,
            description: draft.description.trim(),
            invoice_number: draft.invoice_number || null,
            due_date: draft.due_date || null,
            invoice_attached: true,
          },
          document: { fileName: file!.name, dataUrl: file!.dataUrl, docType: "invoice" },
        },
      });
      toast.success(res.requestNumber);
      setOpen(false);
      reset();
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="size-4" />
          {t("ai.staffTitle")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("ai.staffTitle")}</DialogTitle>
          <DialogDescription>{t("ai.staffHelp")}</DialogDescription>
        </DialogHeader>

        {step === 0 ? (
          <InvoiceAiUpload extract={extract} onExtracted={applyExtraction} compact />
        ) : null}

        {step > 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={step === 1 ? "default" : "secondary"}>1. {t("vp.stepVendor")}</Badge>
            <Badge variant={step === 2 ? "default" : "secondary"}>2. {t("vp.stepRequest")}</Badge>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            {matches.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-medium">{t("vp.matchFound")}</p>
                <p className="text-xs text-muted-foreground">{t("vp.matchHelp")}</p>
                {matches.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 ${
                      vendorId === m.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.vendorName}{" "}
                        <Badge variant="secondary" className="ms-1 align-middle text-[10px]">
                          {m.matchType === "exact" ? t("vp.existing") : t("vp.similar")}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                        {m.country ? ` · ${m.country}` : ""}
                      </p>
                      {m.missing.length > 0 ? (
                        <p className="mt-0.5 text-xs text-destructive">{missingLabel(m.missing)}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={vendorId === m.id ? "default" : "outline"}
                      onClick={() => useVendor(m)}
                    >
                      {t("vp.useVendor")}
                    </Button>
                  </div>
                ))}
                {vendorId ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setVendorId(null)}>
                    {t("vp.createNew")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {vendorComplete ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs">
                <CheckCircle2 className="size-4 text-success-foreground" />
                <span>{t("vp.stepVendor")} ✓</span>
              </div>
            ) : (
              <div className="space-y-1 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  {t("vp.incomplete")}
                </p>
                <p className="text-xs text-destructive">{t("vp.incompleteHelp")}</p>
                <p className="text-xs text-destructive">{missingLabel(missing)}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                id="ai-vendor"
                label={t("vendor.name")}
                value={draft.vendor_name}
                onChange={(v) => set("vendor_name", v)}
                error={missing.includes("vendor_name") ? t("common.required") : undefined}
                required
              />
              <TextField
                id="ai-beneficiary"
                label={t("vendor.beneficiary")}
                value={draft.beneficiary_name}
                onChange={(v) => set("beneficiary_name", v)}
                error={missing.includes("beneficiary_name") ? t("common.required") : undefined}
                required
              />
              <TextField
                id="ai-email"
                label={t("vendor.email")}
                value={draft.email}
                onChange={(v) => set("email", v)}
                error={missing.includes("email") ? t("common.required") : undefined}
                required
              />
              <TextField
                id="ai-country"
                label={t("vendor.country")}
                value={draft.country}
                onChange={(v) => set("country", v)}
                error={missing.includes("country") ? t("common.required") : undefined}
                required
              />
              <TextField
                id="ai-tax"
                label={t("vendor.taxId")}
                value={draft.tax_id}
                onChange={(v) => set("tax_id", v)}
              />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={draft.method === "bank_transfer" ? "default" : "outline"}
                  onClick={() => set("method", "bank_transfer")}
                >
                  {t("method.bank")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={draft.method === "paypal" ? "default" : "outline"}
                  onClick={() => set("method", "paypal")}
                >
                  {t("method.paypal")}
                </Button>
              </div>

              {draft.method === "paypal" ? (
                <TextField
                  id="ai-paypal"
                  className="sm:col-span-2"
                  label={t("paypal.email")}
                  value={draft.paypal_email}
                  onChange={(v) => set("paypal_email", v)}
                  error={missing.includes("paypal_email") ? t("common.required") : undefined}
                  required
                />
              ) : (
                <>
                  <TextField
                    id="ai-bank"
                    label={t("bank.bankName")}
                    value={draft.bank_name}
                    onChange={(v) => set("bank_name", v)}
                    error={missing.includes("bank_name") ? t("common.required") : undefined}
                    required
                  />
                  <TextField
                    id="ai-bank-country"
                    label={t("bank.bankCountry")}
                    value={draft.bank_country}
                    onChange={(v) => set("bank_country", v)}
                    error={missing.includes("bank_country") ? t("common.required") : undefined}
                    required
                  />
                  <TextField
                    id="ai-iban"
                    label={t("bank.iban")}
                    value={draft.iban}
                    onChange={(v) => set("iban", v)}
                    error={missing.includes("iban") ? t("common.required") : undefined}
                  />
                  <TextField
                    id="ai-account"
                    label={t("bank.account")}
                    value={draft.account_number}
                    onChange={(v) => set("account_number", v)}
                  />
                  <TextField
                    id="ai-swift"
                    label={t("bank.swift")}
                    value={draft.swift_bic}
                    onChange={(v) => set("swift_bic", v)}
                    error={missing.includes("swift_bic") ? t("common.required") : undefined}
                  />
                </>
              )}
            </div>

            {bankFromAi ? (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="text-xs text-warning-foreground">{t("ai.bankWarning")}</p>
                <label className="flex items-start gap-2 text-xs">
                  <Checkbox checked={verified} onCheckedChange={(v) => setVerified(v === true)} />
                  <span>{t("ai.bankConfirm")}</span>
                </label>
                {errors["verified"] ? (
                  <p className="text-xs text-destructive">{errors["verified"]}</p>
                ) : null}
              </div>
            ) : null}

            {errors["vendor"] ? <p className="text-xs text-destructive">{errors["vendor"]}</p> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
              {draft.vendor_name} · {draft.email}
            </div>
            <TextField
              id="ai-amount"
              label={t("req.amount")}
              value={draft.amount}
              onChange={(v) => set("amount", v)}
              error={errors["amount"]}
              required
            />
            <TextField
              id="ai-currency"
              label={t("req.currency")}
              value={draft.currency}
              onChange={(v) => set("currency", v.toUpperCase().slice(0, 3))}
              required
            />
            <TextField
              id="ai-description"
              className="sm:col-span-2"
              label={t("req.description")}
              value={draft.description}
              onChange={(v) => set("description", v)}
              error={errors["description"]}
              required
            />
            <TextField
              id="ai-invoice"
              label={t("req.invoiceNumber")}
              value={draft.invoice_number}
              onChange={(v) => set("invoice_number", v)}
            />
            <TextField
              id="ai-due"
              label={t("req.dueDate")}
              type="date"
              value={draft.due_date}
              onChange={(v) => set("due_date", v)}
            />
            {errors["file"] ? (
              <p className="sm:col-span-2 text-xs text-destructive">{errors["file"]}</p>
            ) : null}
            {errors["vendor"] ? (
              <p className="sm:col-span-2 text-xs text-destructive">{errors["vendor"]}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)}>
              {t("vp.back")}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={goToRequest} disabled={!vendorComplete}>
              {t("vp.continue")}
            </Button>
          ) : null}
          {step === 2 ? (
            <Button disabled={busy} onClick={handleSubmit}>
              {t("ai.create")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
