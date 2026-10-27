// ─── Persian formatting helpers (RTL / Jalali) ───────────────────

const faDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/** تبدیل عدد به رقم فارسی با جداکننده هزارگان */
export function faNum(n: number | undefined | null, opts?: Intl.NumberFormatOptions): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "۰";
  return new Intl.NumberFormat("fa-IR", opts).format(n);
}

/** عدد با رقم لاتین (برای ورودی‌ها) */
export function latinNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US").format(n);
}

/** مبلغ خلاصه‌شده: ۱.۲ میلیارد تومان / ۸۵۰ میلیون تومان */
export function faMoney(n: number | undefined | null): string {
  if (!n) return "۰ تومان";
  if (Math.abs(n) >= 1_000_000_000) return `${faNum(Math.round((n / 1_000_000_000) * 10) / 10)} میلیارد تومان`;
  if (Math.abs(n) >= 1_000_000) return `${faNum(Math.round(n / 1_000_000))} میلیون تومان`;
  if (Math.abs(n) >= 1_000) return `${faNum(Math.round(n / 1_000))} هزار تومان`;
  return `${faNum(n)} تومان`;
}

/** مبلغ کامل با جداکننده */
export function faMoneyFull(n: number | undefined | null): string {
  if (!n) return "۰ تومان";
  return `${faNum(Math.round(n))} تومان`;
}

/** تاریخ شمسی کوتاه: ۱۴۰۳/۰۸/۱۲ */
export function faDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** تاریخ شمسی بلند: ۱۲ آبان ۱۴۰۳ */
export function faDateLong(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

/** ماه شمسی برای نمودارها: آبان */
export function faMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", { month: "long" }).format(date);
}

/** تاریخ + ساعت */
export function faDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${faDate(date)} - ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
}

/** زمان نسبی: ۳ روز مانده / ۲ روز گذشته / امروز */
export function faRelativeDue(d: Date | string | null | undefined): { text: string; overdue: boolean; soon: boolean } {
  if (!d) return { text: "بدون سررسید", overdue: false, soon: false };
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { text: "امروز", overdue: false, soon: true };
  if (diff === 1) return { text: "فردا", overdue: false, soon: true };
  if (diff === -1) return { text: "دیروز - ۱ روز گذشته", overdue: true, soon: false };
  if (diff > 1) return { text: `${faNum(diff)} روز مانده`, overdue: false, soon: diff <= 3 };
  return { text: `${faNum(-diff)} روز گذشته`, overdue: true, soon: false };
}

/** مدت زمان: ۱.۲ ثانیه / ۸۵۰ میلی‌ثانیه */
export function faDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${faNum(ms)} میلی‌ثانیه`;
  return `${faNum(Math.round((ms / 1000) * 10) / 10)} ثانیه`;
}

export const DEAL_STAGES = [
  { key: "lead", label: "سرنخ", color: "#8b5cf6" },
  { key: "qualified", label: "واجد شرایط", color: "#06b6d4" },
  { key: "proposal", label: "پیشنهاد قیمت", color: "#f59e0b" },
  { key: "negotiation", label: "مذاکره", color: "#f97316" },
  { key: "won", label: "برنده", color: "#10b981" },
  { key: "lost", label: "باخته", color: "#ef4444" },
] as const;

export const TASK_PRIORITIES = [
  { key: "low", label: "کم", color: "#6b7280" },
  { key: "medium", label: "متوسط", color: "#06b6d4" },
  { key: "high", label: "زیاد", color: "#f59e0b" },
  { key: "urgent", label: "فوری", color: "#ef4444" },
] as const;

export const ACTIVITY_TYPES = [
  { key: "call", label: "تماس", color: "#8b5cf6" },
  { key: "meeting", label: "جلسه", color: "#f59e0b" },
  { key: "email", label: "ایمیل", color: "#10b981" },
  { key: "note", label: "یادداشت", color: "#6b7280" },
] as const;

export const QUOTE_STATUS = [
  { key: "draft", label: "پیش‌نویس", color: "#6b7280" },
  { key: "sent", label: "ارسال‌شده", color: "#f59e0b" },
  { key: "approved", label: "تأییدشده", color: "#10b981" },
  { key: "rejected", label: "ردشده", color: "#ef4444" },
] as const;

export function stageLabel(key: string) {
  return DEAL_STAGES.find((s) => s.key === key)?.label ?? key;
}
export function stageColor(key: string) {
  return DEAL_STAGES.find((s) => s.key === key)?.color ?? "#8b5cf6";
}
export function priorityLabel(key: string) {
  return TASK_PRIORITIES.find((p) => p.key === key)?.label ?? key;
}
export function priorityColor(key: string) {
  return TASK_PRIORITIES.find((p) => p.key === key)?.color ?? "#6b7280";
}
export function activityTypeLabel(key: string) {
  return ACTIVITY_TYPES.find((a) => a.key === key)?.label ?? key;
}
export function quoteStatusLabel(key: string) {
  return QUOTE_STATUS.find((q) => q.key === key)?.label ?? key;
}
export function quoteStatusColor(key: string) {
  return QUOTE_STATUS.find((q) => q.key === key)?.color ?? "#6b7280";
}

/** درصدها */
export function faPercent(n: number, digits = 0): string {
  return `${faNum(Math.round(n * 10 ** digits) / 10 ** digits, { maximumFractionDigits: digits })}٪`;
}
