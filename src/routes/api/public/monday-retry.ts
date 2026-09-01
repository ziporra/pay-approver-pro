import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled retry of failed Monday.com synchronizations.
 *
 * Authenticated with the shared cron secret — never publicly callable.
 */
export const Route = createFileRoute("/api/public/monday-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { processPendingMondaySyncs } = await import("@/lib/monday.server");
        const result = await processPendingMondaySyncs(50);
        return Response.json(result);
      },
    },
  },
});
