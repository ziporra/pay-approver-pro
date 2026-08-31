/** Deterministic identity avatar helpers (initial + stable colour per user). */

export function avatarInitial(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.split("@")[0] || "?").trim();
  return source.slice(0, 1).toUpperCase();
}

export function displayNameFor(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  if (name?.trim()) return name.trim();
  const prefix = email?.split("@")[0] ?? "";
  if (!prefix) return "Unknown user";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Stable avatar colour for a user. Derived from their id (or email) so it never
 * changes between sessions or devices.
 */
export function avatarColor(seed: string | null | undefined, stored?: string | null): string {
  if (stored) return stored;
  const hue = hashString(seed ?? "anonymous") % 360;
  return `hsl(${hue} 62% 42%)`;
}
