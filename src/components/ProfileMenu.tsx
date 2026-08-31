import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, KeyRound, LogOut, ShieldCheck, User } from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { displayNameFor } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n";
import { useStaffProfile } from "@/lib/staff-profile";

const ROLE_KEYS: Record<string, string> = {
  admin: "role.admin",
  approver: "role.approver",
  payment_manager: "role.payment_manager",
  accounting: "role.accounting",
  viewer: "role.viewer",
};

export function ProfileMenu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, roles } = useStaffProfile();

  const name = displayNameFor(profile?.display_name ?? profile?.full_name, profile?.email);
  const roleLabel = roles[0] ? t((ROLE_KEYS[roles[0]] ?? "role.viewer") as never) : "—";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
          <UserAvatar
            id={profile?.id}
            name={name}
            email={profile?.email}
            imageUrl={profile?.avatar_url}
            color={profile?.avatar_color}
            size="sm"
          />
          <span className="hidden text-start leading-tight sm:block">
            <span className="block text-sm font-medium">{name}</span>
            <span className="block text-xs text-muted-foreground">{roleLabel}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-3">
          <UserAvatar
            id={profile?.id}
            name={name}
            email={profile?.email}
            imageUrl={profile?.avatar_url}
            color={profile?.avatar_color}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {profile?.email}
            </span>
            <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              {roleLabel}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" search={{ tab: "profile" }} className="gap-2">
            <User className="size-4" />
            {t("profile.menu.myProfile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" search={{ tab: "security" }} className="gap-2">
            <ShieldCheck className="size-4" />
            {t("profile.menu.security")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" search={{ tab: "security" }} className="gap-2">
            <KeyRound className="size-4" />
            {t("profile.menu.changePassword")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" search={{ tab: "notifications" }} className="gap-2">
            <Bell className="size-4" />
            {t("profile.menu.notifications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="gap-2">
          <LogOut className="size-4" />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
