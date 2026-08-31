import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useStaffProfile } from "@/lib/staff-profile";

/**
 * Blocks the internal app until a staff member replaces the temporary password
 * issued at provisioning time.
 */
export function ForcePasswordChange() {
  const { t } = useI18n();
  const { profile, refresh } = useStaffProfile();

  if (!profile?.must_change_password) return null;

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("security.forcedTitle")}</DialogTitle>
          <DialogDescription>{t("security.forcedBody")}</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onDone={refresh} />
      </DialogContent>
    </Dialog>
  );
}
