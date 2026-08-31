import { createFileRoute } from "@tanstack/react-router";

/**
 * One-time provisioning of the authorized staff accounts.
 *
 * The temporary password is read from the server-side `STAFF_INITIAL_PASSWORD`
 * secret — it is never stored in code, config or the database. Each email gets
 * its own auth identity and is forced to choose a personal password at first
 * sign-in. The endpoint disables itself permanently once an administrator
 * account exists.
 */
const STAFF: { email: string; role: "admin" | "approver" | "payment_manager" | "accounting"; name: string }[] = [
  { email: "office@nanoclear.com", role: "admin", name: "Office" },
  { email: "bill@nanoclear.com", role: "payment_manager", name: "Bill" },
  { email: "kim@ziporra.com", role: "accounting", name: "Kim" },
  { email: "info@ed-b.co.il", role: "approver", name: "Info" },
];

export const Route = createFileRoute("/api/public/bootstrap-staff")({
  server: {
    handlers: {
      POST: async () => {
        const password = process.env["STAFF_INITIAL_PASSWORD"];
        if (!password) {
          return Response.json({ error: "Temporary password is not configured." }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) > 0) {
          return Response.json({ error: "Staff accounts are already provisioned." }, { status: 409 });
        }

        const results: { email: string; status: string }[] = [];

        for (const person of STAFF) {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: person.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: person.name },
          });

          let userId = created?.user?.id ?? null;
          if (error) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
            userId = list?.users.find((u) => u.email === person.email)?.id ?? null;
            if (!userId) {
              results.push({ email: person.email, status: `failed: ${error.message}` });
              continue;
            }
          }

          if (!userId) {
            results.push({ email: person.email, status: "failed: no user id" });
            continue;
          }
          const uid: string = userId;

          await supabaseAdmin.from("profiles").upsert(
            {
              id: uid,
              email: person.email,
              full_name: person.name,
              display_name: person.name,
              must_change_password: true,
            },
            { onConflict: "id" },
          );

          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: uid, role: person.role }, { onConflict: "user_id,role" });

          results.push({ email: person.email, status: created?.user ? "created" : "existing" });
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});
