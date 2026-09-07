import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudDownload, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { listMondayImportRuns, runMondayVendorImport } from "@/lib/monday-import.functions";

/**
 * Admin panel: reconcile (dry run) or import/sync the suppliers that live on
 * the contacts board. Re-running never creates duplicates.
 */
export function MondayVendorImport() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const runImport = useServerFn(runMondayVendorImport);
  const fetchRuns = useServerFn(listMondayImportRuns);

  const { data: runs } = useQuery({
    queryKey: ["monday-import-runs"],
    queryFn: () => fetchRuns(),
  });
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    try {
      const summary = await runImport({ data: { dryRun } });
      toast.success(
        t("vp.importResult", {
          created: summary.created,
          linked: summary.linked + summary.updated,
          conflicts: summary.conflicts,
          skipped: summary.skipped,
          errors: summary.errors,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["monday-import-runs"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-panel">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <p className="font-medium">{t("vp.importTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {runs?.lastSuccess
              ? t("vp.lastSuccess", { when: formatDate(runs.lastSuccess.created_at, locale) })
              : "—"}
            {runs?.lastError
              ? ` · ${t("vp.lastError", { when: formatDate(runs.lastError.created_at, locale) })}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(true)} className="gap-1">
            <RefreshCw className="size-3.5" />
            {t("vp.importDryRun")}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => run(false)} className="gap-1">
            <CloudDownload className="size-3.5" />
            {t("vp.importRun")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
