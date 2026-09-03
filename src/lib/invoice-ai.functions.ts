import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  fileName: z.string().min(1).max(300),
  dataUrl: z.string().min(32).max(24_000_000),
  hint: z.string().max(200).optional().nullable(),
});

/** Public (vendor wizard) invoice reading — rate limited, no data is persisted. */
export const extractInvoicePublic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getAdmin, enforceRateLimit, hashKey } = await import("./vendor-portal.server");
    const { extractInvoiceFields } = await import("./invoice-ai.server");
    const admin = await getAdmin();
    await enforceRateLimit(admin, hashKey(data.hint || data.fileName), "ai_extract", 5, 600);
    try {
      return await extractInvoiceFields(data.fileName, data.dataUrl);
    } catch (error) {
      return {
        ok: false as const,
        reason: error instanceof Error ? error.message : "The invoice could not be read.",
      };
    }
  });

/** Staff-side invoice reading; the extraction is written to the audit log. */
export const extractInvoiceStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { extractInvoiceFields, SENSITIVE_AI_FIELDS } = await import("./invoice-ai.server");
    let result;
    try {
      result = await extractInvoiceFields(data.fileName, data.dataUrl);
    } catch (error) {
      return {
        ok: false as const,
        reason: error instanceof Error ? error.message : "The invoice could not be read.",
      };
    }
    if (result.ok) {
      const safe = result.filled.filter((f) => !SENSITIVE_AI_FIELDS.includes(f));
      const sensitiveCount = result.filled.length - safe.length;
      await context.supabase.rpc("write_audit", {
        _action: "invoice_ai_extract",
        _metadata: {
          file_name: data.fileName,
          fields_filled: safe,
          sensitive_fields_filled: sensitiveCount,
        },
      });
    }
    return result;
  });
