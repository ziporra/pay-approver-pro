import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { ExtractedInvoice } from "@/lib/invoice-ai.server";

export type PickedFile = { name: string; dataUrl: string; size: number };

type ExtractResponse =
  | { ok: true; fields: ExtractedInvoice; filled: string[] }
  | { ok: false; reason: string };

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 15 * 1024 * 1024;

export function InvoiceAiUpload({
  extract,
  onExtracted,
  hint,
  compact,
}: {
  extract: (input: { data: { fileName: string; dataUrl: string; hint?: string | null } }) => Promise<ExtractResponse>;
  onExtracted: (fields: ExtractedInvoice, filled: string[], file: PickedFile) => void;
  hint?: string | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setError(null);
    if (!ALLOWED.includes(selected.type)) {
      setError(t("docs.formats"));
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("The file is larger than 15 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const picked: PickedFile = { name: selected.name, dataUrl, size: selected.size };
      setFileName(selected.name);
      setBusy(true);
      try {
        const res = await extract({
          data: { fileName: selected.name, dataUrl, hint: hint ?? null },
        });
        if (res.ok) onExtracted(res.fields, res.filled, picked);
        else setError(res.reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(selected);
  }

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-dashed border-border bg-surface p-4"
          : "rounded-lg border border-dashed border-primary/40 bg-primary/5 p-5"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            {t("ai.title")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("ai.help")}</p>
          {fileName ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{fileName}</p>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={onPick}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? (
            <>
              <Loader2 className="me-2 size-4 animate-spin" />
              {t("ai.reading")}
            </>
          ) : (
            t("ai.upload")
          )}
        </Button>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
