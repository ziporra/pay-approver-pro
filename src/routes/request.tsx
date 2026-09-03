import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/Brand";
import { InvoiceAiUpload } from "@/components/InvoiceAiUpload";
import { extractInvoicePublic } from "@/lib/invoice-ai.functions";
import type { ExtractedInvoice } from "@/lib/invoice-ai.server";

import { LanguageSelector } from "@/components/LanguageSelector";
import { Field, TextField } from "@/components/wizard/Field";
import { Stepper } from "@/components/wizard/Stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import {
  COUNTRIES,
  PAYMENT_CATEGORIES,
  SORTED_CURRENCIES,
  ibanExpected,
  isValidEmail,
  isValidIban,
  isValidSwift,
  localBankFields,
  type LocalBankField,
} from "@/lib/reference";
import {
  lookupVendorByEmail,
  searchVendorsByName,
  submitPaymentRequest,
} from "@/lib/vendor-portal.functions";

export const Route = createFileRoute("/request")({
  head: () => ({
    meta: [
      { title: "Submit a payment request — Ledgerline" },
      {
        name: "description",
        content:
          "Vendor form to submit a payment request: identify yourself, confirm banking details, describe the payment and attach an invoice.",
      },
      { property: "og:title", content: "Submit a payment request — Ledgerline" },
      {
        property: "og:description",
        content: "Guided vendor form for submitting a payment request for approval.",
      },
    ],
  }),
  component: RequestWizard,
});

type VendorForm = {
  vendor_name: string;
  beneficiary_name: string;
  contact_first_name: string;
  contact_last_name: string;
  email: string;
  phone: string;
  address_line: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  registration_number: string;
  tax_id: string;
};

type PaymentForm = {
  method: "paypal" | "bank_transfer";
  paypal_email: string;
  paypal_account_name: string;
  paypal_link: string;
  beneficiary_name: string;
  beneficiary_address: string;
  beneficiary_country: string;
  bank_name: string;
  bank_address: string;
  bank_country: string;
  swift_bic: string;
  account_number: string;
  iban: string;
  routing_number: string;
  sort_code: string;
  branch_number: string;
  clabe: string;
  bsb: string;
  transit_number: string;
  local_clearing_code: string;
  intermediary_bank: string;
  instructions: string;
};

const emptyVendor: VendorForm = {
  vendor_name: "",
  beneficiary_name: "",
  contact_first_name: "",
  contact_last_name: "",
  email: "",
  phone: "",
  address_line: "",
  city: "",
  state_province: "",
  postal_code: "",
  country: "",
  registration_number: "",
  tax_id: "",
};

const emptyPayment: PaymentForm = {
  method: "bank_transfer",
  paypal_email: "",
  paypal_account_name: "",
  paypal_link: "",
  beneficiary_name: "",
  beneficiary_address: "",
  beneficiary_country: "",
  bank_name: "",
  bank_address: "",
  bank_country: "",
  swift_bic: "",
  account_number: "",
  iban: "",
  routing_number: "",
  sort_code: "",
  branch_number: "",
  clabe: "",
  bsb: "",
  transit_number: "",
  local_clearing_code: "",
  intermediary_bank: "",
  instructions: "",
};

const LOCAL_FIELD_LABELS: Record<LocalBankField, string> = {
  routing_number: "bank.routing",
  sort_code: "bank.sortCode",
  branch_number: "bank.branch",
  clabe: "bank.clabe",
  bsb: "bank.bsb",
  transit_number: "bank.transit",
  local_clearing_code: "bank.clearing",
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Map a free-text country from an invoice onto the supported country list. */
function matchCountry(value: string): string {
  const needle = value.trim().toLowerCase();
  if (!needle) return "";
  return COUNTRIES.find((c) => c.toLowerCase() === needle) ?? "";
}

function RequestWizard() {
  const { t, locale } = useI18n();
  const lookup = useServerFn(lookupVendorByEmail);
  const search = useServerFn(searchVendorsByName);
  const submit = useServerFn(submitPaymentRequest);
  const extractAi = useServerFn(extractInvoicePublic);

  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [bankFromAi, setBankFromAi] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [step, setStep] = useState(0);

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendor, setVendor] = useState<VendorForm>(emptyVendor);
  const [payment, setPayment] = useState<PaymentForm>(emptyPayment);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poReference, setPoReference] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [docType, setDocType] = useState<"invoice" | "proforma">("invoice");
  const [file, setFile] = useState<{ name: string; dataUrl: string; size: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ requestNumber: string; duplicate: boolean } | null>(null);

  // Step 1 lookup state
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "found" | "notFound">("idle");
  const [maskedSummary, setMaskedSummary] = useState<string[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [matches, setMatches] = useState<{ id: string; vendorName: string; location: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const steps = [
    t("wizard.step1"),
    t("wizard.step2"),
    t("wizard.step3"),
    t("wizard.step4"),
    t("wizard.step5"),
    t("wizard.step6"),
  ];

  const localFields = useMemo(
    () => localBankFields(payment.bank_country || undefined),
    [payment.bank_country],
  );
  const needsIban = ibanExpected(payment.bank_country || undefined);

  function setVendorField<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setVendor((prev) => ({ ...prev, [key]: value }));
  }
  function setPaymentField<K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) {
    setPayment((prev) => ({ ...prev, [key]: value }));
  }

  function applyExtraction(
    fields: ExtractedInvoice,
    filled: string[],
    picked: { name: string; dataUrl: string; size: number },
  ) {
    const filledKeys = new Set<string>();
    const take = (value: string | null, key: string) => {
      if (!value) return "";
      filledKeys.add(key);
      return value;
    };

    setVendor((prev) => ({
      ...prev,
      vendor_name: prev.vendor_name || take(fields.vendor_name, "vendor_name"),
      beneficiary_name:
        prev.beneficiary_name ||
        take(fields.beneficiary_name ?? fields.vendor_name, "beneficiary_name"),
      contact_first_name: prev.contact_first_name || take(fields.contact_first_name, "contact_first_name"),
      contact_last_name: prev.contact_last_name || take(fields.contact_last_name, "contact_last_name"),
      email: prev.email || take(fields.email, "email"),
      phone: prev.phone || take(fields.phone, "phone"),
      address_line: prev.address_line || take(fields.address_line, "address_line"),
      city: prev.city || take(fields.city, "city"),
      state_province: prev.state_province || take(fields.state_province, "state_province"),
      postal_code: prev.postal_code || take(fields.postal_code, "postal_code"),
      country: prev.country || matchCountry(take(fields.country, "country")),
      registration_number: prev.registration_number || take(fields.registration_number, "registration_number"),
      tax_id: prev.tax_id || take(fields.tax_id, "tax_id"),
    }));

    const bankKeys = [
      "bank_name",
      "bank_address",
      "swift_bic",
      "iban",
      "account_number",
      "routing_number",
      "sort_code",
      "branch_number",
      "clabe",
      "bsb",
      "transit_number",
      "local_clearing_code",
      "intermediary_bank",
      "paypal_email",
    ] as const;
    let touchedBank = false;
    setPayment((prev) => {
      const next = { ...prev };
      if (fields.method) {
        next.method = fields.method;
        filledKeys.add("method");
      } else if (fields.iban || fields.account_number) {
        next.method = "bank_transfer";
      } else if (fields.paypal_email) {
        next.method = "paypal";
      }
      for (const key of bankKeys) {
        const value = fields[key];
        if (value && !next[key]) {
          next[key] = value;
          filledKeys.add(key);
          touchedBank = true;
        }
      }
      if (!next.bank_country && fields.bank_country) {
        next.bank_country = matchCountry(fields.bank_country);
        if (next.bank_country) filledKeys.add("bank_country");
      }
      if (!next.beneficiary_name) {
        const value = fields.beneficiary_name ?? fields.vendor_name;
        if (value) {
          next.beneficiary_name = value;
          filledKeys.add("p_beneficiary_name");
        }
      }
      return next;
    });

    if (fields.amount && !amount) {
      setAmount(fields.amount);
      filledKeys.add("amount");
    }
    if (fields.currency && SORTED_CURRENCIES.some((c) => c.code === fields.currency)) {
      setCurrency(fields.currency);
      filledKeys.add("currency");
    }
    if (fields.description && !description) {
      setDescription(fields.description);
      filledKeys.add("description");
    }
    if (fields.category && PAYMENT_CATEGORIES.some((c) => c.key === fields.category) && !category) {
      setCategory(fields.category);
      filledKeys.add("category");
    }
    if (fields.invoice_number && !invoiceNumber) {
      setInvoiceNumber(fields.invoice_number);
      filledKeys.add("invoice_number");
    }
    if (fields.po_reference && !poReference) {
      setPoReference(fields.po_reference);
      filledKeys.add("po_reference");
    }
    if (fields.due_date && /^\d{4}-\d{2}-\d{2}$/.test(fields.due_date) && !dueDate) {
      setDueDate(fields.due_date);
      filledKeys.add("due_date");
    }

    setFile(picked);
    setDocType("invoice");
    setBankFromAi(touchedBank);
    setBankVerified(false);
    setAiFilled(new Set([...filledKeys]));
    toast.success(t("ai.filledCount", { count: filledKeys.size }));
    void filled;
  }


  async function handleLookup() {
    if (!isValidEmail(lookupEmail)) {
      setErrors({ lookupEmail: t("common.required") });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const res = await lookup({ data: { email: lookupEmail.trim() } });
      if (res.found) {
        setVendorId(res.vendor.id);
        setVendor((prev) => ({
          ...prev,
          vendor_name: res.vendor.vendorName,
          beneficiary_name: res.vendor.beneficiaryName,
          contact_first_name: res.vendor.contactName.split(" ")[0] ?? "",
          contact_last_name: res.vendor.contactName.split(" ").slice(1).join(" "),
          email: lookupEmail.trim(),
          city: res.vendor.city ?? "",
          country: res.vendor.country ?? "",
        }));
        if (res.vendor.preferredCurrency) setCurrency(res.vendor.preferredCurrency);
        if (res.vendor.method) setPaymentField("method", res.vendor.method);
        setMaskedSummary([
          `${res.vendor.vendorName}`,
          `${res.vendor.maskedEmail}`,
          `${res.vendor.maskedPhone}`,
          `${res.vendor.maskedPaymentSummary}`,
        ]);
        setLookupState("found");
      } else {
        setVendor((prev) => ({ ...prev, email: lookupEmail.trim() }));
        setLookupState("notFound");
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function handleNameSearch(value: string) {
    setNameQuery(value);
    if (value.trim().length < 3) {
      setMatches([]);
      return;
    }
    try {
      const res = await search({ data: { query: value.trim() } });
      setMatches(res.matches);
    } catch {
      setMatches([]);
    }
  }

  function validateStep(index: number): boolean {
    const next: Record<string, string> = {};
    if (index === 1) {
      if (vendor.vendor_name.trim().length < 2) next["vendor_name"] = t("common.required");
      if (vendor.beneficiary_name.trim().length < 2) next["beneficiary_name"] = t("common.required");
      if (!isValidEmail(vendor.email)) next["email"] = t("common.required");
    }
    if (index === 2) {
      if (payment.method === "paypal") {
        if (!isValidEmail(payment.paypal_email)) next["paypal_email"] = t("common.required");
        if (payment.paypal_account_name.trim().length < 2)
          next["paypal_account_name"] = t("common.required");
      } else {
        if (payment.beneficiary_name.trim().length < 2)
          next["p_beneficiary_name"] = t("common.required");
        if (payment.bank_name.trim().length < 2) next["bank_name"] = t("common.required");
        if (!payment.bank_country) next["bank_country"] = t("common.required");
        if (payment.swift_bic && !isValidSwift(payment.swift_bic))
          next["swift_bic"] = "Enter a valid 8 or 11 character SWIFT/BIC code.";
        if (needsIban) {
          if (!payment.iban) next["iban"] = t("common.required");
          else if (!isValidIban(payment.iban)) next["iban"] = "Enter a valid IBAN.";
        } else if (!payment.account_number) {
          next["account_number"] = t("common.required");
        }
      }
      if (bankFromAi && !bankVerified) next["bankVerified"] = t("ai.bankWarning");
    }

    if (index === 3) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) next["amount"] = t("common.required");
      if (description.trim().length < 3) next["description"] = t("common.required");
    }
    if (index === 4) {
      if (!file) next["file"] = t("docs.help");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(selected.type)) {
      setErrors({ file: "Only PDF, JPG, JPEG or PNG files are accepted." });
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setErrors({ file: "The file is larger than 15 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: selected.name, dataUrl: String(reader.result), size: selected.size });
      setErrors({});
    };
    reader.readAsDataURL(selected);
  }

  async function handleSubmit() {
    if (!confirmed || !file) {
      setErrors({ confirm: t("review.confirm") });
      return;
    }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          vendorId,
          vendor: {
            vendor_name: vendor.vendor_name.trim(),
            beneficiary_name: vendor.beneficiary_name.trim(),
            contact_first_name: vendor.contact_first_name || null,
            contact_last_name: vendor.contact_last_name || null,
            email: vendor.email.trim(),
            phone: vendor.phone || null,
            address_line: vendor.address_line || null,
            city: vendor.city || null,
            state_province: vendor.state_province || null,
            postal_code: vendor.postal_code || null,
            country: vendor.country || null,
            registration_number: vendor.registration_number || null,
            tax_id: vendor.tax_id || null,
          },
          payment: {
            method: payment.method,
            paypal_email: payment.paypal_email || null,
            paypal_account_name: payment.paypal_account_name || null,
            paypal_link: payment.paypal_link || null,
            beneficiary_name: payment.beneficiary_name || null,
            beneficiary_address: payment.beneficiary_address || null,
            beneficiary_country: payment.beneficiary_country || null,
            bank_name: payment.bank_name || null,
            bank_address: payment.bank_address || null,
            bank_country: payment.bank_country || null,
            swift_bic: payment.swift_bic || null,
            account_number: payment.account_number || null,
            iban: payment.iban || null,
            routing_number: payment.routing_number || null,
            sort_code: payment.sort_code || null,
            branch_number: payment.branch_number || null,
            clabe: payment.clabe || null,
            bsb: payment.bsb || null,
            transit_number: payment.transit_number || null,
            local_clearing_code: payment.local_clearing_code || null,
            intermediary_bank: payment.intermediary_bank || null,
            instructions: payment.instructions || null,
          },
          request: {
            amount: Number(amount),
            currency,
            description: description.trim(),
            category: category || null,
            invoice_number: invoiceNumber || null,
            po_reference: poReference || null,
            due_date: dueDate || null,
            notes: notes || null,
            invoice_attached: docType === "invoice",
          },
          document: { fileName: file.name, dataUrl: file.dataUrl, docType },
        },
      });
      setResult({ requestNumber: res.requestNumber, duplicate: res.possibleDuplicate });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Shell>
        <Card className="mx-auto max-w-xl shadow-elevated">
          <CardContent className="space-y-4 py-10 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h1 className="text-2xl font-semibold tracking-tight">{t("success.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("success.body")}</p>
            <p className="rounded-lg bg-surface px-4 py-3 font-mono text-lg tracking-tight">
              {result.requestNumber}
            </p>
            {result.duplicate ? (
              <p className="text-xs text-warning-foreground">{t("review.duplicateWarning")}</p>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t("wizard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("wizard.stepOf", { current: step + 1, total: steps.length })}
          </p>
        </div>
        <div className="mb-6 overflow-x-auto pb-1">
          <Stepper steps={steps} current={step} />
        </div>

        {aiFilled.size > 0 ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{t("ai.filledCount", { count: aiFilled.size })}</span>
          </div>
        ) : null}

        <Card className="shadow-panel">
          <CardContent className="space-y-6 py-6">
            {step === 0 ? (
              <div className="space-y-5">
                <InvoiceAiUpload extract={extractAi} onExtracted={applyExtraction} hint={lookupEmail} />

                <Field
                  label={t("identify.emailLabel")}
                  htmlFor="lookup-email"
                  hint={t("identify.emailHelp")}
                  {...(errors["lookupEmail"] ? { error: errors["lookupEmail"] } : {})}
                  required
                >
                  <div className="flex gap-2">
                    <Input
                      id="lookup-email"
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                    />
                    <Button type="button" onClick={handleLookup} disabled={busy}>
                      {busy ? <Loader2 className="size-4 animate-spin" /> : t("identify.lookup")}
                    </Button>
                  </div>
                </Field>

                {lookupState === "found" ? (
                  <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                    <p className="text-sm text-foreground">{t("identify.found")}</p>
                    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {maskedSummary.map((line) => (
                        <li key={line} className="font-mono text-xs">
                          {line}
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-4" onClick={() => setStep(1)}>
                      {t("identify.confirm")}
                    </Button>
                  </div>
                ) : null}

                {lookupState === "notFound" ? (
                  <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
                    <p className="text-sm text-muted-foreground">{t("identify.notFound")}</p>
                    <Field label={t("identify.searchByName")} htmlFor="name-search">
                      <div className="relative">
                        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="name-search"
                          className="ps-9"
                          value={nameQuery}
                          onChange={(e) => handleNameSearch(e.target.value)}
                        />
                      </div>
                    </Field>
                    {matches.length > 0 ? (
                      <ul className="divide-y divide-border rounded-md border border-border bg-card">
                        {matches.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2.5 text-start text-sm hover:bg-accent"
                              onClick={() => {
                                setVendorId(m.id);
                                setVendorField("vendor_name", m.vendorName);
                                setStep(1);
                              }}
                            >
                              <span>{m.vendorName}</span>
                              <span className="text-xs text-muted-foreground">{m.location}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setVendorId(null);
                        setStep(1);
                      }}
                    >
                      {t("identify.createNew")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="vendor_name"
                  label={t("vendor.name")}
                  value={vendor.vendor_name}
                  onChange={(v) => setVendorField("vendor_name", v)}
                  error={errors["vendor_name"]}
                  required
                />
                <TextField
                  id="beneficiary_name"
                  label={t("vendor.beneficiary")}
                  value={vendor.beneficiary_name}
                  onChange={(v) => setVendorField("beneficiary_name", v)}
                  error={errors["beneficiary_name"]}
                  required
                />
                <TextField
                  id="first"
                  label={t("vendor.firstName")}
                  value={vendor.contact_first_name}
                  onChange={(v) => setVendorField("contact_first_name", v)}
                />
                <TextField
                  id="last"
                  label={t("vendor.lastName")}
                  value={vendor.contact_last_name}
                  onChange={(v) => setVendorField("contact_last_name", v)}
                />
                <TextField
                  id="v_email"
                  type="email"
                  label={t("vendor.email")}
                  value={vendor.email}
                  onChange={(v) => setVendorField("email", v)}
                  error={errors["email"]}
                  required
                />
                <TextField
                  id="phone"
                  label={t("vendor.phone")}
                  value={vendor.phone}
                  onChange={(v) => setVendorField("phone", v)}
                />
                <TextField
                  id="address"
                  className="sm:col-span-2"
                  label={t("vendor.address")}
                  value={vendor.address_line}
                  onChange={(v) => setVendorField("address_line", v)}
                />
                <TextField
                  id="city"
                  label={t("vendor.city")}
                  value={vendor.city}
                  onChange={(v) => setVendorField("city", v)}
                />
                <TextField
                  id="state"
                  label={t("vendor.state")}
                  value={vendor.state_province}
                  onChange={(v) => setVendorField("state_province", v)}
                />
                <TextField
                  id="postal"
                  label={t("vendor.postal")}
                  value={vendor.postal_code}
                  onChange={(v) => setVendorField("postal_code", v)}
                />
                <Field label={t("vendor.country")} htmlFor="country">
                  <Select
                    value={vendor.country}
                    onValueChange={(v) => setVendorField("country", v)}
                  >
                    <SelectTrigger id="country">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField
                  id="reg"
                  label={t("vendor.registration")}
                  value={vendor.registration_number}
                  onChange={(v) => setVendorField("registration_number", v)}
                  hint={t("vendor.optional")}
                />
                <TextField
                  id="tax"
                  label={t("vendor.taxId")}
                  value={vendor.tax_id}
                  onChange={(v) => setVendorField("tax_id", v)}
                  hint={t("vendor.optional")}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium">{t("method.title")}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["bank_transfer", t("method.bank")],
                        ["paypal", t("method.paypal")],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPaymentField("method", value)}
                        className={`rounded-lg border px-4 py-3 text-start text-sm font-medium transition-colors ${
                          payment.method === value
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {payment.method === "paypal" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="pp_email"
                      type="email"
                      label={t("paypal.email")}
                      value={payment.paypal_email}
                      onChange={(v) => setPaymentField("paypal_email", v)}
                      error={errors["paypal_email"]}
                      required
                    />
                    <TextField
                      id="pp_name"
                      label={t("paypal.name")}
                      value={payment.paypal_account_name}
                      onChange={(v) => setPaymentField("paypal_account_name", v)}
                      error={errors["paypal_account_name"]}
                      required
                    />
                    <TextField
                      id="pp_link"
                      className="sm:col-span-2"
                      label={t("paypal.link")}
                      value={payment.paypal_link}
                      onChange={(v) => setPaymentField("paypal_link", v)}
                      hint={t("vendor.optional")}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="b_name"
                      label={t("bank.beneficiaryName")}
                      value={payment.beneficiary_name}
                      onChange={(v) => setPaymentField("beneficiary_name", v)}
                      error={errors["p_beneficiary_name"]}
                      required
                    />
                    <TextField
                      id="b_addr"
                      label={t("bank.beneficiaryAddress")}
                      value={payment.beneficiary_address}
                      onChange={(v) => setPaymentField("beneficiary_address", v)}
                    />
                    <Field label={t("bank.beneficiaryCountry")} htmlFor="b_country">
                      <Select
                        value={payment.beneficiary_country}
                        onValueChange={(v) => setPaymentField("beneficiary_country", v)}
                      >
                        <SelectTrigger id="b_country">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <TextField
                      id="bank_name"
                      label={t("bank.bankName")}
                      value={payment.bank_name}
                      onChange={(v) => setPaymentField("bank_name", v)}
                      error={errors["bank_name"]}
                      required
                    />
                    <TextField
                      id="bank_addr"
                      label={t("bank.bankAddress")}
                      value={payment.bank_address}
                      onChange={(v) => setPaymentField("bank_address", v)}
                    />
                    <Field
                      label={t("bank.bankCountry")}
                      htmlFor="bank_country"
                      required
                      {...(errors["bank_country"] ? { error: errors["bank_country"] } : {})}
                    >
                      <Select
                        value={payment.bank_country}
                        onValueChange={(v) => setPaymentField("bank_country", v)}
                      >
                        <SelectTrigger id="bank_country">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <TextField
                      id="swift"
                      label={t("bank.swift")}
                      value={payment.swift_bic}
                      onChange={(v) => setPaymentField("swift_bic", v.toUpperCase())}
                      error={errors["swift_bic"]}
                    />
                    {needsIban ? (
                      <TextField
                        id="iban"
                        label={t("bank.iban")}
                        value={payment.iban}
                        onChange={(v) => setPaymentField("iban", v.toUpperCase())}
                        error={errors["iban"]}
                        required
                      />
                    ) : (
                      <TextField
                        id="acct"
                        label={t("bank.account")}
                        value={payment.account_number}
                        onChange={(v) => setPaymentField("account_number", v)}
                        error={errors["account_number"]}
                        required
                      />
                    )}
                    {localFields.map((f) => (
                      <TextField
                        key={f}
                        id={f}
                        label={t(LOCAL_FIELD_LABELS[f] as never)}
                        value={payment[f]}
                        onChange={(v) => setPaymentField(f, v)}
                      />
                    ))}
                    <TextField
                      id="intermediary"
                      className="sm:col-span-2"
                      label={t("bank.intermediary")}
                      value={payment.intermediary_bank}
                      onChange={(v) => setPaymentField("intermediary_bank", v)}
                      hint={t("vendor.optional")}
                    />
                  </div>
                )}

                {bankFromAi ? (
                  <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <p className="text-xs text-warning-foreground">{t("ai.bankWarning")}</p>
                    <label className="flex items-start gap-2 text-xs">
                      <Checkbox
                        checked={bankVerified}
                        onCheckedChange={(v) => setBankVerified(v === true)}
                      />
                      <span>{t("ai.bankConfirm")}</span>
                    </label>
                    {errors["bankVerified"] ? (
                      <p className="text-xs text-destructive">{errors["bankVerified"]}</p>
                    ) : null}
                  </div>
                ) : null}

                <p className="flex items-start gap-2 rounded-lg bg-surface p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                  Your banking details are stored privately and shown to our finance team in masked
                  form only. Any change to them is flagged for verification.
                </p>

              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="amount"
                  type="number"
                  label={t("request.amount")}
                  value={amount}
                  onChange={setAmount}
                  error={errors["amount"]}
                  required
                />
                <Field label={t("request.currency")} htmlFor="currency" required>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {SORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  className="sm:col-span-2"
                  label={t("request.description")}
                  htmlFor="desc"
                  required
                  {...(errors["description"] ? { error: errors["description"] } : {})}
                >
                  <Textarea
                    id="desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <Field label={t("request.category")} htmlFor="cat">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="cat">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField
                  id="due"
                  type="date"
                  label={t("request.dueDate")}
                  value={dueDate}
                  onChange={setDueDate}
                />
                <TextField
                  id="inv"
                  label={t("request.invoiceNumber")}
                  value={invoiceNumber}
                  onChange={setInvoiceNumber}
                  hint={t("vendor.optional")}
                />
                <TextField
                  id="po"
                  label={t("request.po")}
                  value={poReference}
                  onChange={setPoReference}
                  hint={t("vendor.optional")}
                />
                <Field className="sm:col-span-2" label={t("request.notes")} htmlFor="notes">
                  <Textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium">{t("docs.title")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("docs.help")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["invoice", t("docs.invoiceAttached")],
                      ["proforma", t("docs.invoiceLater")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDocType(value)}
                      className={`rounded-lg border px-4 py-3 text-start text-sm font-medium transition-colors ${
                        docType === value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
                  <FileUp className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">{file ? file.name : t("docs.upload")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("docs.formats")}</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => fileInput.current?.click()}
                  >
                    {file ? "Replace file" : t("docs.upload")}
                  </Button>
                </div>
                {errors["file"] ? <p className="text-xs text-destructive">{errors["file"]}</p> : null}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-5">
                <h2 className="text-sm font-medium">{t("review.title")}</h2>
                <ReviewBlock
                  title={t("wizard.step2")}
                  rows={[
                    [t("vendor.name"), vendor.vendor_name],
                    [t("vendor.beneficiary"), vendor.beneficiary_name],
                    [t("vendor.email"), vendor.email],
                    [t("vendor.phone"), vendor.phone],
                    [t("vendor.country"), vendor.country],
                  ]}
                />
                <ReviewBlock
                  title={t("wizard.step3")}
                  rows={
                    payment.method === "paypal"
                      ? [
                          [t("method.title"), t("method.paypal")],
                          [t("paypal.email"), payment.paypal_email],
                          [t("paypal.name"), payment.paypal_account_name],
                        ]
                      : [
                          [t("method.title"), t("method.bank")],
                          [t("bank.bankName"), payment.bank_name],
                          [t("bank.bankCountry"), payment.bank_country],
                          [
                            needsIban ? t("bank.iban") : t("bank.account"),
                            `•••• ${(needsIban ? payment.iban : payment.account_number).slice(-4)}`,
                          ],
                        ]
                  }
                />
                <ReviewBlock
                  title={t("wizard.step4")}
                  rows={[
                    [t("request.amount"), `${currency} ${amount}`],
                    [t("request.description"), description],
                    [t("request.dueDate"), dueDate || "—"],
                    [t("request.invoiceNumber"), invoiceNumber || "—"],
                  ]}
                />
                <ReviewBlock
                  title={t("wizard.step5")}
                  rows={[
                    [
                      docType === "invoice" ? t("docs.invoiceAttached") : t("docs.invoiceLater"),
                      file?.name ?? "—",
                    ],
                  ]}
                />
                {docType === "proforma" ? (
                  <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    This request will remain open after payment until the final invoice is provided.
                  </p>
                ) : null}
                <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
                  <Checkbox
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(v === true)}
                    className="mt-0.5"
                  />
                  <span>{t("review.confirm")}</span>
                </label>
                {errors["confirm"] ? (
                  <p className="text-xs text-destructive">{errors["confirm"]}</p>
                ) : null}
              </div>
            ) : null}

            {step > 0 ? (
              <div className="flex items-center justify-between border-t border-border pt-5">
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  {t("wizard.back")}
                </Button>
                {step < steps.length - 1 ? (
                  <Button onClick={goNext}>{t("wizard.next")}</Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={busy || !confirmed}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : t("wizard.submit")}
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground" dir="auto">
          {locale.toUpperCase()} · Ledgerline vendor portal
        </p>
      </div>
    </Shell>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="text-sm">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-foreground">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border/70 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/">
            <Brand />
          </Link>
          <LanguageSelector />
        </div>
      </header>
      <main className="px-5 py-10">{children}</main>
    </div>
  );
}
