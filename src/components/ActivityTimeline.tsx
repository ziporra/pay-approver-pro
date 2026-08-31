import { useQuery } from "@tanstack/react-query";

import { UserAvatar } from "@/components/UserAvatar";
import { displayNameFor } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n";
import { getPaymentActivity } from "@/lib/staff.functions";

type Actor = {
  id: string;
  avatar_url: string | null;
  avatar_color: string | null;
  display_name: string | null;
  email: string;
};

function actionLabel(action: string): string {
  return action.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Immutable per-request activity timeline. Sensitive fields are shown only as
 * masked before/after values — full bank data never reaches the log.
 */
export function ActivityTimeline({ requestId }: { requestId: string }) {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["activity", requestId],
    queryFn: () => getPaymentActivity({ data: { requestId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const events = data?.events ?? [];
  const actors = new Map((data?.actors ?? []).map((a) => [a.id, a as Actor]));

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>;
  }

  return (
    <ol className="relative space-y-5 ps-2">
      {events.map((event) => {
        const actor = event.actor_id ? actors.get(event.actor_id) : undefined;
        const name = displayNameFor(actor?.display_name ?? event.actor_label, event.actor_email);
        return (
          <li key={event.id} className="flex gap-3">
            <UserAvatar
              id={event.actor_id}
              name={name}
              email={event.actor_email}
              imageUrl={actor?.avatar_url}
              color={actor?.avatar_color}
              size="sm"
            />
            <div className="min-w-0 flex-1 border-b border-border/60 pb-4 last:border-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">{event.actor_email}</span>
                <span className="ms-auto text-xs tabular-nums text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.occurred_at))}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-foreground">{actionLabel(event.action)}</p>
              {event.previous_status || event.new_status ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("activity.previous")}: {event.previous_status ?? "—"} → {t("activity.new")}:{" "}
                  {event.new_status ?? "—"}
                </p>
              ) : null}
              {event.field ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.field}: {event.old_value_masked ?? "—"} → {event.new_value_masked ?? "—"}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
