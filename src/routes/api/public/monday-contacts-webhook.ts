import { createFileRoute } from "@tanstack/react-router";

/**
 * Inbound synchronisation from the Monday Contacts board.
 *
 * Delivery is authenticated with a shared secret (`MONDAY_WEBHOOK_SECRET`),
 * sent either as the `x-monday-secret` header or a `?token=` query parameter,
 * so the public path cannot be used by anyone else. Monday's subscription
 * handshake (`challenge`) is answered before any work is done, and echoes of
 * our own outbound updates are ignored inside `syncInboundContact`.
 */
export const Route = createFileRoute("/api/public/monday-contacts-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: { challenge?: string; event?: { pulseId?: number | string } } = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        // Subscription handshake — must be answered before auth checks.
        if (body.challenge) return Response.json({ challenge: body.challenge });

        const secret = process.env["MONDAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook secret not configured", { status: 503 });
        const provided =
          request.headers.get("x-monday-secret") ?? new URL(request.url).searchParams.get("token");
        if (provided !== secret) return new Response("Unauthorized", { status: 401 });

        const itemId = body.event?.pulseId;
        if (!itemId) return Response.json({ ok: true, skipped: "no item id" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncInboundContact } = await import("@/lib/monday-import.server");
        try {
          const outcome = await syncInboundContact(supabaseAdmin as never, String(itemId));
          return Response.json({ ok: true, result: outcome.result });
        } catch (error) {
          console.error("[Monday inbound] failed", error instanceof Error ? error.message : error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
