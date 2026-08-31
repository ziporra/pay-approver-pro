import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/dictionaries";
import { getMyStaffProfile } from "@/lib/staff.functions";

export type StaffProfile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  locale: string;
  notification_prefs: unknown;
  must_change_password: boolean;
  password_changed_at: string | null;
};

type Value = {
  profile: StaffProfile | null;
  roles: string[];
  isAdmin: boolean;
  loading: boolean;
  refresh: () => void;
};

const Ctx = createContext<Value>({
  profile: null,
  roles: [],
  isAdmin: false,
  loading: true,
  refresh: () => {},
});

export const staffProfileQueryKey = ["staff", "me"] as const;

export function StaffProfileProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { locale, setLocale } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: staffProfileQueryKey,
    queryFn: () => getMyStaffProfile(),
    staleTime: 60_000,
  });

  const profile = (data?.profile ?? null) as StaffProfile | null;

  // The saved profile language wins on sign-in, so the choice follows the user
  // between devices.
  useEffect(() => {
    const saved = profile?.locale as Locale | undefined;
    if (saved && saved !== locale) setLocale(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.locale]);

  const roles = data?.roles ?? [];

  return (
    <Ctx.Provider
      value={{
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        loading: isLoading,
        refresh: () => void queryClient.invalidateQueries({ queryKey: staffProfileQueryKey }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStaffProfile(): Value {
  return useContext(Ctx);
}
