/** Human-readable byte size, e.g. 1.4 GB. Decimal units to match transfer speeds. */
export function formatBytes(value: number): string {
  let number = Number(value) || 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  while (number >= 1000 && unit < units.length - 1) {
    number /= 1000;
    unit++;
  }
  const digits = unit === 0 ? 0 : number >= 100 ? 0 : 1;
  return `${number.toFixed(digits)} ${units[unit]}`;
}

/** Relative time until a share expires, e.g. "in 23h" or "in 45m". */
export function formatExpiry(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
