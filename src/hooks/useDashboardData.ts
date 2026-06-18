// Shared time-formatting helpers. (The face-recognition dashboard hook that
// used to live here was archived with the glasses hardware features —
// see hardware-archive/ and hardware-archive/RESTORE.md.)

export function formatRelativeTime(iso: string): string {
  if (!iso) return "Never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (isNaN(diff)) return "recently";
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatTimeShort(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
