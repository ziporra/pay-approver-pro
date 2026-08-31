import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ForcePasswordChange } from "@/components/ForcePasswordChange";
import { supabase } from "@/integrations/supabase/client";
import { StaffProfileProvider } from "@/lib/staff-profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <StaffProfileProvider>
      <AppShell>
        <ForcePasswordChange />
        <Outlet />
      </AppShell>
    </StaffProfileProvider>
  ),
});
