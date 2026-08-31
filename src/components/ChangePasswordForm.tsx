import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { markPasswordChanged } from "@/lib/staff.functions";

/** Password change form used both in Security settings and the forced-change dialog. */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      toast.error(t("security.mismatch"));
      return;
    }
    if (next.length < 10) {
      toast.error(t("security.tooShort"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: next,
        ...(current ? ({ current_password: current } as Record<string, string>) : {}),
      });
      if (error) throw error;
      await markPasswordChanged();
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(t("security.updated"));
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current-password">{t("security.currentPassword")}</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">{t("security.newPassword")}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t("security.confirmPassword")}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy}>
        {t("security.changePassword")}
      </Button>
    </form>
  );
}
