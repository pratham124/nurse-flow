export function formatLocalId(prefix: string, uniquePart: string): string {
  const safePrefix = prefix.trim() || "local";

  return `${safePrefix}-${uniquePart}`;
}
