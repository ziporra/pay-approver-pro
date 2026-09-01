import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Recent Monday sync activity, admin only. */
export const listMondaySyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data } = await context.supabase
      .from("monday_sync_logs")
      .select(
        "id, action, entity_type, status, attempts, monday_item_id, error, next_attempt_at, created_at, payment_request_id, vendor_id",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    return { rows: data ?? [] };
  });

/** Admin-triggered retry of everything still pending. */
export const retryMondaySyncs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ limit: z.number().min(1).max(100).optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { processPendingMondaySyncs } = await import("./monday.server");
    return processPendingMondaySyncs(data.limit ?? 25);
  });
