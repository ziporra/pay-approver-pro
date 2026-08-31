import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type DirectoryBank = {
  id: string | null;
  bankName: string;
  swiftBic: string | null;
  country: string;
  bankAddress: string | null;
  /** True only when the record comes from a trusted directory source. */
  verified: boolean;
  source: string;
};

export type DirectoryBranch = {
  id: string;
  branchName: string;
  branchCode: string | null;
  branchAddress: string | null;
};

/**
 * Provider-independent bank directory contract.
 *
 * The application never depends on a specific banking API: a provider can be
 * added, replaced or disabled without touching the payment flow. When no
 * provider is available the UI falls back to manual entry.
 */
export interface BankDirectoryProvider {
  readonly name: string;
  isConfigured(): boolean;
  searchBanks(country: string, query: string): Promise<DirectoryBank[]>;
  searchBranches?(bankId: string, query: string): Promise<DirectoryBranch[]>;
}

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Internal cache of public bank metadata. Always available, never fabricated. */
const internalCacheProvider: BankDirectoryProvider = {
  name: "internal-cache",
  isConfigured: () => true,
  async searchBanks(country, query) {
    const supabase = publicClient();
    let request = supabase
      .from("bank_directory")
      .select("id, bank_name, swift_bic, country, bank_address, verified, source")
      .eq("country", country)
      .order("bank_name")
      .limit(10);
    if (query.trim()) request = request.ilike("bank_name", `%${query.trim()}%`);
    const { data, error } = await request;
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id,
      bankName: row.bank_name,
      swiftBic: row.swift_bic,
      country: row.country,
      bankAddress: row.bank_address,
      verified: row.verified,
      source: row.source,
    }));
  },
};

/**
 * External provider slot. No external banking API is configured yet, so this
 * provider reports itself as unavailable and the chain falls through to the
 * internal cache plus manual entry. Wire a real implementation here later
 * (reading its credentials from server-side env only).
 */
const externalProvider: BankDirectoryProvider = {
  name: "external",
  isConfigured: () => Boolean(process.env["BANK_DIRECTORY_API_KEY"]),
  async searchBanks() {
    return [];
  },
};

const providers: BankDirectoryProvider[] = [internalCacheProvider, externalProvider];

/** Resolution chain: internal cache → external provider (if configured) → empty (manual fallback). */
export async function resolveBanks(country: string, query: string): Promise<DirectoryBank[]> {
  const results: DirectoryBank[] = [];
  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    try {
      const found = await provider.searchBanks(country, query);
      for (const bank of found) {
        if (!results.some((b) => b.bankName.toLowerCase() === bank.bankName.toLowerCase())) {
          results.push(bank);
        }
      }
    } catch {
      // A failing provider must never break the payment request.
    }
    if (results.length >= 10) break;
  }
  return results.slice(0, 10);
}

export async function resolveBranches(
  bankId: string,
  query: string,
): Promise<DirectoryBranch[]> {
  for (const provider of providers) {
    if (!provider.isConfigured() || !provider.searchBranches) continue;
    try {
      const found = await provider.searchBranches(bankId, query);
      if (found.length) return found;
    } catch {
      // ignore and fall through to manual entry
    }
  }
  return [];
}
