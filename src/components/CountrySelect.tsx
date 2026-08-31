import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRY_OPTIONS, countryByName } from "@/lib/countries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null | undefined;
  onChange: (name: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
};

/** Searchable country selector with flags, codes and keyboard navigation. */
export function CountrySelect({ value, onChange, id, disabled, placeholder }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = countryByName(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.flag} ${selected.name}` : (placeholder ?? t("country.placeholder"))}
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.trim().toLowerCase();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={t("country.search")} />
          <CommandList>
            <CommandEmpty>{t("country.empty")}</CommandEmpty>
            <CommandGroup>
              {COUNTRY_OPTIONS.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.code}`}
                  onSelect={() => {
                    onChange(country.name);
                    setOpen(false);
                  }}
                >
                  <span className="me-2">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="text-xs text-muted-foreground">{country.code}</span>
                  {selected?.code === country.code ? <Check className="ms-2 size-4" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
