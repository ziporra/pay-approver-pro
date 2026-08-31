import { useMutation } from "@tanstack/react-query";
import { Check, ChevronsUpDown, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchBankDirectory } from "@/lib/bank-directory.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type BankSelection = {
  bankName: string;
  swiftBic?: string | null;
  bankAddress?: string | null;
  directoryBankId?: string | null;
  /** "directory" when picked from a trusted directory, "manual" when typed in. */
  entrySource: "directory" | "manual";
};

type Props = {
  country: string | null | undefined;
  value: string;
  entrySource: "directory" | "manual";
  onSelect: (selection: BankSelection) => void;
};

type Bank = {
  id: string | null;
  bankName: string;
  swiftBic: string | null;
  bankAddress: string | null;
  verified: boolean;
};

/**
 * Bank name field. Offers directory autocomplete for the selected country and
 * always allows manual entry — a missing directory never blocks a request.
 */
export function BankSelect({ country, value, entrySource, onSelect }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(entrySource === "manual" && Boolean(value));
  const [banks, setBanks] = useState<Bank[]>([]);
  const [available, setAvailable] = useState(true);

  const search = useMutation({
    mutationFn: (q: string) => searchBankDirectory({ data: { country: country ?? "", query: q } }),
    onSuccess: (res) => {
      setBanks(res.banks as Bank[]);
      setAvailable(res.available);
    },
    onError: () => setAvailable(false),
  });

  useEffect(() => {
    if (!open || !country) return;
    const handle = setTimeout(() => search.mutate(query), 220);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, country]);

  if (manual) {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          placeholder={t("bank.bankName")}
          onChange={(e) =>
            onSelect({ bankName: e.target.value, entrySource: "manual", directoryBankId: null })
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5" />
            {t("bank.manualFlag")}
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setManual(false)}
          >
            {t("bank.useDirectory")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={!country}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || (country ? t("bank.searchPlaceholder") : t("bank.selectCountryFirst"))}
            </span>
            <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("bank.searchPlaceholder")}
            />
            <CommandList>
              <CommandEmpty>
                {available ? t("bank.noMatches") : t("bank.directoryUnavailable")}
              </CommandEmpty>
              <CommandGroup>
                {banks.map((bank) => (
                  <CommandItem
                    key={`${bank.id ?? bank.bankName}`}
                    value={bank.bankName}
                    onSelect={() => {
                      onSelect({
                        bankName: bank.bankName,
                        swiftBic: bank.swiftBic,
                        bankAddress: bank.bankAddress,
                        directoryBankId: bank.id,
                        entrySource: "directory",
                      });
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1">{bank.bankName}</span>
                    {bank.swiftBic ? (
                      <span className="text-xs text-muted-foreground">{bank.swiftBic}</span>
                    ) : null}
                    {value === bank.bankName ? <Check className="ms-2 size-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {value && entrySource === "directory" ? (
          <span
            title={t("bank.verifiedHelp")}
            className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success"
          >
            <ShieldCheck className="size-3.5" />
            {t("bank.verified")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t("bank.verifiedHelp")}</span>
        )}
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setManual(true);
            onSelect({ bankName: value, entrySource: "manual", directoryBankId: null });
          }}
        >
          {t("bank.manualFallback")}
        </button>
      </div>
    </div>
  );
}
