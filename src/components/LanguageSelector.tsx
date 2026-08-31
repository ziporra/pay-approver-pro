import { Check, Languages } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LOCALES, useI18n } from "@/lib/i18n";
import { updateMyProfile } from "@/lib/staff.functions";

export function LanguageSelector({
  variant = "ghost",
  persist = false,
}: {
  variant?: "ghost" | "outline";
  /** Save the choice to the signed-in staff profile so it follows the user. */
  persist?: boolean;
}) {
  const { locale, setLocale } = useI18n();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]!;

  function choose(code: (typeof LOCALES)[number]["code"]) {
    setLocale(code);
    if (persist) void updateMyProfile({ data: { locale: code } }).catch(() => {});
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          <Languages className="size-4 opacity-70" />
          <span aria-hidden>{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.code} onSelect={() => choose(l.code)} className="gap-2">
            <span aria-hidden>{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === locale ? <Check className="size-4 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
