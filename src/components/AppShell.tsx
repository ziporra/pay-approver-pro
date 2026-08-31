import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Receipt, ScrollText, Users } from "lucide-react";
import type { ReactNode } from "react";

import { Brand } from "@/components/Brand";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useI18n } from "@/lib/i18n";
import { useStaffProfile } from "@/lib/staff-profile";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useStaffProfile();

  const nav = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard, admin: false },
    { to: "/payments", label: t("nav.payments"), icon: Receipt, admin: false },
    { to: "/vendors", label: t("nav.vendors"), icon: Users, admin: false },
    { to: "/audit", label: t("nav.audit"), icon: ScrollText, admin: true },
  ] as const;

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
          <Link to="/dashboard">
            <Brand />
          </Link>
          <nav className="flex items-center gap-1">
            {nav
              .filter((item) => !item.admin || isAdmin)
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith(item.to)
                      ? "bg-primary/8 text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSelector persist />
            <ProfileMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
