import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Reconcile / import suppliers from the Monday Contacts board.
 *
 * Authenticated with the shared cron secret, so it is never publicly callable.
 * `{"dryRun": true}` reports what would happen without writing anything.
 */
export const Route = createFileRoute("/api/public/monday-vendor-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        let dryRun = true;
        try {
          const body = (await request.json()) as { dryRun?: boolean };
          dryRun = body?.dryRun !== false;
        } catch {
          /* default: dry run */
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { importMondayContacts } = await import("@/lib/monday-import.server");
        try {
          const summary = await importMondayContacts(supabaseAdmin as never, { dryRun });
          return Response.json({
            dryRun: summary.dryRun,
            scanned: summary.scanned,
            created: summary.created,
            linked: summary.linked,
            updated: summary.updated,
            conflicts: summary.conflicts,
            skipped: summary.skipped,
            errors: summary.errors,
            outcomes: summary.outcomes.map((o) => ({
              id: o.mondayItemId,
              name: o.name,
              result: o.result,
              conflicts: o.conflicts,
              message: o.message,
            })),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Import failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
