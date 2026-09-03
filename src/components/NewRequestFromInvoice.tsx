import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { InvoiceAiUpload, type PickedFile } from "@/components/InvoiceAiUpload";
import { TextField } from "@/components/wizard/Field";
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
import { isValidEmail, SORTED_CURRENCIES } from "@/lib/reference";
import { submitPaymentRequest } from "@/lib/vendor-portal.functions";

type Draft = {
  vendor_name: string;
  beneficiary_name: string;
  email: string;
  country: string;
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
  const submit = useServerFn(submitPaymentRequest);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [bankFromAi, setBankFromAi] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyExtraction(fields: ExtractedInvoice, _filled: string[], picked: PickedFile) {
    void _filled;
    setFile(picked);
    setDraft((prev) => ({
      ...prev,
      vendor_name: fields.vendor_name ?? prev.vendor_name,
      beneficiary_name: fields.beneficiary_name ?? fields.vendor_name ?? prev.beneficiary_name,
      email: fields.email ?? prev.email,
      country: fields.country ?? prev.country,
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
    const touchedBank = Boolean(
      fields.iban || fields.account_number || fields.swift_bic || fields.paypal_email,
    );
    setBankFromAi(touchedBank);
    setVerified(false);
    toast.success(t("ai.filledCount", { count: fields ? Object.values(fields).filter(Boolean).length : 0 }));
  }

  async function handleSubmit() {
    const next: Record<string, string> = {};
    if (draft.vendor_name.trim().length < 2) next["vendor_name"] = t("common.required");
    if (draft.beneficiary_name.trim().length < 2) next["beneficiary_name"] = t("common.required");
    if (!isValidEmail(draft.email)) next["email"] = t("common.required");
    if (!(Number(draft.amount) > 0)) next["amount"] = t("common.required");
    if (draft.description.trim().length < 3) next["description"] = t("common.required");
    if (draft.method === "paypal") {
      if (!isValidEmail(draft.paypal_email)) next["paypal_email"] = t("common.required");
    } else {
      if (draft.bank_name.trim().length < 2) next["bank_name"] = t("common.required");
      if (!draft.iban && !draft.account_number) next["iban"] = t("common.required");
    }
    if (!file) next["file"] = t("docs.help");
    if (bankFromAi && !verified) next["verified"] = t("ai.bankWarning");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const res = await submit({
        data: {
          vendorId: null,
          vendor: {
            vendor_name: draft.vendor_name.trim(),
            beneficiary_name: draft.beneficiary_name.trim(),
            email: draft.email.trim(),
            country: draft.country || null,
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
      setDraft(emptyDraft);
      setFile(null);
      setBankFromAi(false);
      setVerified(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

        <InvoiceAiUpload extract={extract} onExtracted={applyExtraction} compact />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="ai-vendor"
            label="Vendor name"
            value={draft.vendor_name}
            onChange={(v) => set("vendor_name", v)}
            error={errors["vendor_name"]}
            required
          />
          <TextField
            id="ai-beneficiary"
            label="Beneficiary name"
            value={draft.beneficiary_name}
            onChange={(v) => set("beneficiary_name", v)}
            error={errors["beneficiary_name"]}
            required
          />
          <TextField
            id="ai-email"
            label="Vendor email"
            value={draft.email}
            onChange={(v) => set("email", v)}
            error={errors["email"]}
            required
          />
          <TextField
            id="ai-country"
            label="Country"
            value={draft.country}
            onChange={(v) => set("country", v)}
          />
          <TextField
            id="ai-amount"
            label="Amount"
            value={draft.amount}
            onChange={(v) => set("amount", v)}
            error={errors["amount"]}
            required
          />
          <TextField
            id="ai-currency"
            label="Currency"
            value={draft.currency}
            onChange={(v) => set("currency", v.toUpperCase().slice(0, 3))}
            required
          />
          <TextField
            id="ai-description"
            className="sm:col-span-2"
            label="Description"
            value={draft.description}
            onChange={(v) => set("description", v)}
            error={errors["description"]}
            required
          />
          <TextField
            id="ai-invoice"
            label="Invoice number"
            value={draft.invoice_number}
            onChange={(v) => set("invoice_number", v)}
          />
          <TextField
            id="ai-due"
            label="Due date"
            type="date"
            value={draft.due_date}
            onChange={(v) => set("due_date", v)}
          />
          {draft.method === "paypal" ? (
            <TextField
              id="ai-paypal"
              className="sm:col-span-2"
              label="PayPal email"
              value={draft.paypal_email}
              onChange={(v) => set("paypal_email", v)}
              error={errors["paypal_email"]}
              required
            />
          ) : (
            <>
              <TextField
                id="ai-bank"
                label="Bank name"
                value={draft.bank_name}
                onChange={(v) => set("bank_name", v)}
                error={errors["bank_name"]}
                required
              />
              <TextField
                id="ai-bank-country"
                label="Bank country"
                value={draft.bank_country}
                onChange={(v) => set("bank_country", v)}
              />
              <TextField
                id="ai-iban"
                label="IBAN"
                value={draft.iban}
                onChange={(v) => set("iban", v)}
                error={errors["iban"]}
              />
              <TextField
                id="ai-account"
                label="Account number"
                value={draft.account_number}
                onChange={(v) => set("account_number", v)}
              />
              <TextField
                id="ai-swift"
                label="SWIFT / BIC"
                value={draft.swift_bic}
                onChange={(v) => set("swift_bic", v)}
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

        {errors["file"] ? <p className="text-xs text-destructive">{errors["file"]}</p> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={busy} onClick={handleSubmit}>
            {t("ai.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
