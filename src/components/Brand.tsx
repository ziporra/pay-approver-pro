import { cn } from "@/lib/utils";

export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg text-sm font-semibold tracking-tight",
          inverted ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        L
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Ledgerline</span>
        <span className={cn("text-[11px]", inverted ? "text-sidebar-foreground/60" : "text-muted-foreground")}>
          Payment operations
        </span>
      </span>
    </span>
  );
}
