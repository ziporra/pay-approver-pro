import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Roles for the signed-in user, used to shape the internal UI. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      roles: (data ?? []).map((r) => r.role as string),
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
    };
  });

/** Payment requests visible to the signed-in staff member. */
export const listPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, invoice_number, due_date, invoice_status, possible_duplicate, created_at, paid_at, vendors(vendor_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { rows: [], error: error.message };
    return { rows: data ?? [], error: null };
  });

/** Vendor directory for internal users. */
export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vendors")
      .select(
        "id, vendor_name, beneficiary_name, email, city, country, preferred_currency, preferred_payment_method, payment_details_changed, is_favorite, created_at",
      )
      .order("vendor_name")
      .limit(500);
    if (error) return { rows: [], error: error.message };
    return { rows: data ?? [], error: null };
  });

/** Vendor card: profile, ledger totals per currency and payment history. */
export const getVendorLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ vendorId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: vendor } = await context.supabase
      .from("vendors")
      .select("*")
      .eq("id", data.vendorId)
      .maybeSingle();
    if (!vendor) throw new Error("Vendor not found");

    const { data: requests } = await context.supabase
      .from("payment_requests")
      .select(
        "id, request_number, status, amount, currency, category, description, due_date, invoice_status, paid_at, created_at",
      )
      .eq("vendor_id", data.vendorId)
      .order("created_at", { ascending: false });

    const { data: changes } = await context.supabase
      .from("vendor_detail_changes")
      .select("id, field, old_masked, new_masked, reviewed, created_at")
      .eq("vendor_id", data.vendorId)
      .order("created_at", { ascending: false })
      .limit(10);

    return { vendor, requests: requests ?? [], changes: changes ?? [] };
  });
