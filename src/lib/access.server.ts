/** Server-side role checks. Never trust the browser for these. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
type Client = SupabaseClient<Database>;

/** Roles cleared to see employee records and payroll-type expenses. */
export const PAYROLL_ROLES: AppRole[] = ["admin", "accounting", "payment_manager"];

export async function getRoles(supabase: Client, userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as AppRole);
}

export function hasAny(roles: AppRole[], allowed: AppRole[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

export async function requireRoles(
  supabase: Client,
  userId: string,
  allowed: AppRole[],
): Promise<AppRole[]> {
  const roles = await getRoles(supabase, userId);
  if (roles.length === 0) throw new Error("Your account has no access to this workspace.");
  if (!hasAny(roles, allowed)) throw new Error("You are not authorised to perform this action.");
  return roles;
}

export async function requirePayrollAccess(supabase: Client, userId: string): Promise<AppRole[]> {
  return requireRoles(supabase, userId, PAYROLL_ROLES);
}
