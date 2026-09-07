import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { saveVendorProfile } from "@/lib/internal.functions";
import { SORTED_CURRENCIES } from "@/lib/reference";
import { missingPayoutFields, VENDOR_FIELD_LABEL_KEYS } from "@/lib/vendor-completeness";

/**
 * Standalone supplier save. Only the supplier name is required — anything the
 * team does not have yet is flagged and can be completed later.
 */
export function NewVendorDialog() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(saveVendorProfile);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vendor_name: "",
    beneficiary_name: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    tax_id: "",
    preferred_currency: "",
    method: "" as "" | "paypal" | "bank_transfer",
    paypal_email: "",
    bank_name: "",
    bank_country: "",
    swift_bic: "",
    iban: "",
    account_number: "",
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const missing = missingPayoutFields({
    ...form,
    method: form.method || null,
  });

  const mutation = useMutation({
    mutationFn: () => save({ data: { ...form, method: form.method || null } }),
    onSuccess: () => {
      toast.success(t("exp.saved"));
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bank = form.method === "bank_transfer";
  const paypal = form.method === "paypal";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("exp.newVendor")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("exp.newVendor")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("exp.partialHelp")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="v-name">{t("vendor.name")}</Label>
            <Input id="v-name" value={form.vendor_name} onChange={set("vendor_name")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="v-benef">{t("vendor.beneficiary")}</Label>
            <Input id="v-benef" value={form.beneficiary_name} onChange={set("beneficiary_name")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="v-email">{t("vendor.email")}</Label>
            <Input id="v-email" value={form.email} onChange={set("email")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="v-country">{t("exp.country")}</Label>
            <Input id="v-country" value={form.country} onChange={set("country")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="v-city">{t("vendor.city")}</Label>
            <Input id="v-city" value={form.city} onChange={set("city")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="v-tax">{t("vendor.taxId")}</Label>
            <Input id="v-tax" value={form.tax_id} onChange={set("tax_id")} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="v-cur">{t("exp.currency")}</Label>
            <select
              id="v-cur"
              value={form.preferred_currency}
              onChange={set("preferred_currency")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {SORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="v-method">{t("exp.paymentDetails")}</Label>
            <select
              id="v-method"
              value={form.method}
              onChange={set("method")}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              <option value="paypal">PayPal</option>
              <option value="bank_transfer">{t("method.bank")}</option>
            </select>
          </div>

          {paypal ? (
            <div className="sm:col-span-2">
              <Label htmlFor="v-pp">{t("paypal.email")}</Label>
              <Input id="v-pp" value={form.paypal_email} onChange={set("paypal_email")} className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">{t("exp.noBankForPaypal")}</p>
            </div>
          ) : null}

          {bank ? (
            <>
              <div>
                <Label htmlFor="v-bank">{t("bank.bankName")}</Label>
                <Input id="v-bank" value={form.bank_name} onChange={set("bank_name")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="v-bankcountry">{t("bank.bankCountry")}</Label>
                <Input
                  id="v-bankcountry"
                  value={form.bank_country}
                  onChange={set("bank_country")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="v-iban">{t("bank.iban")}</Label>
                <Input id="v-iban" value={form.iban} onChange={set("iban")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="v-acc">{t("bank.account")}</Label>
                <Input id="v-acc" value={form.account_number} onChange={set("account_number")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="v-swift">{t("bank.swift")}</Label>
                <Input id="v-swift" value={form.swift_bic} onChange={set("swift_bic")} className="mt-1" />
              </div>
            </>
          ) : null}
        </div>

        {missing.length > 0 ? (
          <p className="text-sm text-destructive">
            {t("exp.payoutMissing")}:{" "}
            {missing
              .map((f) => t((VENDOR_FIELD_LABEL_KEYS[f] ?? "exp.paymentDetails") as "vendor.name"))
              .join(", ")}
          </p>
        ) : (
          <p className="text-sm text-success-foreground">{t("exp.payoutReady")}</p>
        )}

        <Button
          className="mt-2"
          disabled={form.vendor_name.trim().length < 2 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t("exp.savePartial")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
