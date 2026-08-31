import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { displayNameFor } from "@/lib/avatar";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { useStaffProfile } from "@/lib/staff-profile";
import { updateMyProfile } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";

type ProfilePatch = {
  displayName?: string;
  locale?: Locale;
  avatarUrl?: string | null;
  notificationPrefs?: Record<string, boolean>;
};

type Tab = "profile" | "security" | "notifications";

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (["profile", "security", "notifications"] as const).includes(search["tab"] as Tab)
      ? (search["tab"] as Tab)
      : ("profile" as Tab),
  }),
  head: () => ({
    meta: [
      { title: "My profile — Ledgerline" },
      { name: "description", content: "Manage your staff identity, language and security settings." },
      { property: "og:title", content: "My profile — Ledgerline" },
      { property: "og:description", content: "Staff identity, language and password settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const NOTIFICATION_KEYS = [
  { key: "approval", label: "notify.approval" },
  { key: "payment", label: "notify.payment" },
  { key: "invoice", label: "notify.invoice" },
] as const;

function ProfilePage() {
  const { t, locale, setLocale } = useI18n();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { profile, roles, refresh } = useStaffProfile();

  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? profile?.full_name ?? "");
  }, [profile?.display_name, profile?.full_name]);

  // Avatars live in a private bucket, so render them through a signed URL.
  useEffect(() => {
    let active = true;
    const path = profile?.avatar_url;
    if (!path) {
      setAvatarSrc(null);
      return;
    }
    void supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setAvatarSrc(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  const prefs = (profile?.notification_prefs ?? {}) as Record<string, boolean>;

  const save = useMutation({
    mutationFn: (input: ProfilePatch) => updateMyProfile({ data: input }),
    onSuccess: () => {
      refresh();
      toast.success(t("profile.saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  async function handleAvatar(file: File) {
    if (!profile) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${profile.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      await save.mutateAsync({ avatarUrl: path });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  }

  const name = displayNameFor(profile?.display_name ?? profile?.full_name, profile?.email);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => void navigate({ search: { tab: value as Tab } })}
      >
        <TabsList>
          <TabsTrigger value="profile">{t("profile.tab.profile")}</TabsTrigger>
          <TabsTrigger value="security">{t("profile.tab.security")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("profile.tab.notifications")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("profile.avatar")}</CardTitle>
              <CardDescription>{t("profile.avatarHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <UserAvatar
                id={profile?.id}
                name={name}
                email={profile?.email}
                imageUrl={avatarSrc}
                color={profile?.avatar_color}
                size="lg"
              />
              <div className="flex flex-wrap gap-2">
                <Label
                  htmlFor="avatar-file"
                  className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
                >
                  {uploading ? t("common.loading") : t("profile.upload")}
                </Label>
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAvatar(file);
                  }}
                />
                {profile?.avatar_url ? (
                  <Button
                    variant="ghost"
                    onClick={() => save.mutate({ avatarUrl: null })}
                    disabled={save.isPending}
                  >
                    {t("profile.removePhoto")}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("profile.tab.profile")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">{t("profile.displayName")}</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  maxLength={80}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("profile.email")}</Label>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
                <div className="space-y-1">
                  <Label>{t("profile.role")}</Label>
                  <p className="text-sm text-muted-foreground">{roles.join(", ") || "—"}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("profile.language")}</Label>
                <div className="flex flex-wrap gap-2">
                  {LOCALES.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setLocale(option.code as Locale);
                        save.mutate({ locale: option.code as Locale });
                      }}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm",
                        locale === option.code
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-input text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <span className="me-1.5">{option.flag}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => save.mutate({ displayName })}
                disabled={save.isPending}
              >
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("security.title")}</CardTitle>
              <CardDescription>
                {t("security.lastChanged")}:{" "}
                {profile?.password_changed_at
                  ? formatDate(profile.password_changed_at, locale)
                  : t("security.never")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm onDone={refresh} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("profile.tab.notifications")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {NOTIFICATION_KEYS.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={item.key}>{t(item.label as never)}</Label>
                  <Switch
                    id={item.key}
                    checked={prefs[item.key] ?? true}
                    onCheckedChange={(checked) =>
                      save.mutate({
                        notificationPrefs: { ...prefs, [item.key]: checked },
                      })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
