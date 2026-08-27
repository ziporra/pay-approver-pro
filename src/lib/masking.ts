/** Mask everything but the last 4 characters of an account identifier. */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= visible) return "•".repeat(clean.length);
  return `•••• ${clean.slice(-visible)}`;
}

/** Mask an email as t••••r@domain.com */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return "—";
  const [user, domain] = value.split("@");
  if (!domain || !user) return "•••";
  const head = user.slice(0, 1);
  const tail = user.length > 2 ? user.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, user.length - 2))}${tail}@${domain}`;
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.replace(/\s+/g, "");
  return clean.length <= 4 ? "•".repeat(clean.length) : `•••••${clean.slice(-3)}`;
}
