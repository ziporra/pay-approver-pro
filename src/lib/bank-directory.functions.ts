import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchSchema = z.object({
  country: z.string().min(2).max(80),
  query: z.string().max(80).default(""),
});

/** Public bank autocomplete. Returns public bank identity data only. */
export const searchBankDirectory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => searchSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveBanks } = await import("./bank-directory.server");
    try {
      const banks = await resolveBanks(data.country, data.query);
      return { banks, available: true };
    } catch {
      return { banks: [], available: false };
    }
  });

const branchSchema = z.object({ bankId: z.string().min(1), query: z.string().max(80).default("") });

/** Branch autocomplete. Empty when no reliable branch data source exists. */
export const searchBankBranches = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => branchSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveBranches } = await import("./bank-directory.server");
    try {
      return { branches: await resolveBranches(data.bankId, data.query) };
    } catch {
      return { branches: [] };
    }
  });
