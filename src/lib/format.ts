const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export const fmtTime = (ts: number) => timeFmt.format(new Date(ts));
export const fmtDay = (ts: number) => dayFmt.format(new Date(ts)).replace(".", "");
export const fmtLongDay = (ts: number) => longDayFmt.format(new Date(ts));
export const fmtMonth = (ts: number) => monthFmt.format(new Date(ts)).toUpperCase();

export function lateLabel(seconds: number) {
  if (seconds <= 120) return "à l'heure";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min de retard`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m ? `${h} h ${String(m).padStart(2, "0")} de retard` : `${h} h de retard`;
}

export function lateShort(seconds: number) {
  if (seconds <= 120) return "à l'heure";
  if (seconds < 3600) return `+${Math.floor(seconds / 60)} min`;
  return `+${Math.floor(seconds / 3600)} h`;
}

export function relTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function duration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${String(rest).padStart(2, "0")}` : `${h} h`;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function isLight(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66;
}

export function dayKeyLocal(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
}
