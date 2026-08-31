import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/** Signed-in staff member: profile, roles and forced-password-change state. */
export const getMyStaffProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select(
        "id, email, full_name, display_name, avatar_url, avatar_color, locale, notification_prefs, must_change_password, password_changed_at",
      )
      .eq("id", context.userId)
      .maybeSingle();

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    return {
      profile: profile ?? null,
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });

const profileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  locale: z.enum(["en", "he", "es", "zh"]).optional(),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName || null;
    if (data.locale !== undefined) patch.locale = data.locale;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (data.notificationPrefs !== undefined) patch.notification_prefs = data.notificationPrefs;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Records that the user set their own password; clears the forced-change flag. */
export const markPasswordChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ must_change_password: false, password_changed_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase.rpc("write_audit", { _action: "password_changed" });
    return { ok: true };
  });

/** Staff directory for audit-log filters and attribution. */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, full_name, avatar_url, avatar_color")
      .order("email");
    return { staff: data ?? [] };
  });

const auditFilterSchema = z.object({
  actorId: z.string().uuid().nullable().optional(),
  action: z.string().max(80).nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  paymentRequestId: z.string().uuid().nullable().optional(),
  from: z.string().max(30).nullable().optional(),
  to: z.string().max(30).nullable().optional(),
  status: z.string().max(40).nullable().optional(),
  documentsOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

/** Administrator-level audit log with filters. Read-only for everyone. */
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => auditFilterSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { rows: [], forbidden: true as const };

    let query = context.supabase
      .from("audit_logs")
      .select(
        "id, occurred_at, actor_id, actor_label, actor_email, actor_role, action, field, old_value_masked, new_value_masked, previous_status, new_status, payment_request_id, vendor_id, metadata",
      )
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.actorId) query = query.eq("actor_id", data.actorId);
    if (data.action) query = query.eq("action", data.action);
    if (data.vendorId) query = query.eq("vendor_id", data.vendorId);
    if (data.paymentRequestId) query = query.eq("payment_request_id", data.paymentRequestId);
    if (data.from) query = query.gte("occurred_at", data.from);
    if (data.to) query = query.lte("occurred_at", `${data.to}T23:59:59Z`);
    if (data.status) query = query.eq("new_status", data.status);
    if (data.documentsOnly) {
      query = query.in("action", [
        "document_uploaded",
        "payment_confirmation_uploaded",
        "invoice_received",
      ]);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], forbidden: false as const };
  });

/** Activity timeline for one payment request. */
export const getPaymentActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("audit_logs")
      .select(
        "id, occurred_at, actor_id, actor_label, actor_email, actor_role, action, field, old_value_masked, new_value_masked, previous_status, new_status, metadata",
      )
      .eq("payment_request_id", data.requestId)
      .order("occurred_at", { ascending: false });

    const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
    const { data: profiles } = actorIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, avatar_url, avatar_color, display_name, email")
          .in("id", actorIds)
      : { data: [] };

    return { events: rows ?? [], actors: profiles ?? [] };
  });
