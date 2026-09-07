import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
  };
  const { data } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/**
 * Dry-run (reconcile) or execute the supplier import from the Monday Contacts
 * board. Both paths are admin only and are recorded in `monday_import_runs`.
 */
export const runMondayVendorImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ dryRun: z.boolean() }).parse(data ?? { dryRun: true }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { importMondayContacts } = await import("./monday-import.server");
    const summary = await importMondayContacts(supabaseAdmin as never, {
      dryRun: data.dryRun,
      startedBy: context.userId,
    });
    return summary;
  });

/** Import history with the last successful run and any errors, for the UI. */
export const listMondayImportRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("monday_import_runs")
      .select(
        "id, kind, status, scanned, created_count, linked_count, conflict_count, skipped_count, error_count, error, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = data ?? [];
    return {
      rows,
      lastSuccess: rows.find((r) => r.status === "success" && r.kind !== "dry_run") ?? null,
      lastError: rows.find((r) => r.error_count > 0 || r.status === "partial") ?? null,
    };
  });
