import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/format";

const TONES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  awaiting_approval: "bg-warning/15 text-warning-foreground",
  approved: "bg-success/12 text-success",
  rejected: "bg-destructive/10 text-destructive",
  awaiting_payment: "bg-info/12 text-info",
  paid: "bg-success/15 text-success",
  awaiting_invoice: "bg-warning/18 text-warning-foreground",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-border/60",
        TONES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
