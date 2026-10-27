"use client";

// ───────────────────────────────────────────────────────────────────
// داشبورد مدیریت — رودین CRM
// Quiet Precision: neutral surfaces, hairline borders, one accent via
// primary tokens, staggered entrances, count-up KPIs, Persian charts.
// ───────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { animate, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowLeft, Briefcase, Download, FileText, History, Lightbulb, ListTodo,
  Percent, RefreshCw, Sparkles, TrendingUp, Users, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCrmStore, type Section } from "@/lib/crm-store";
import type { DashboardDto } from "@/lib/types";
import {
  ACTIVITY_TYPES, activityTypeLabel, faDateLong, faMoney, faMoneyFull, faMonth, faNum,
  faPercent, faRelativeDue, priorityColor, priorityLabel, stageColor, stageLabel,
} from "@/lib/format";

// ─── Constants ──────────────────────────────────────────────────────

const PALETTE_FALLBACK = ["#8b5cf6", "#f59e0b", "#10b981", "#f97316", "#ec4899", "#06b6d4"];
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: "انجام‌نشده", color: "#f59e0b" },
  in_progress: { label: "در حال انجام", color: "#06b6d4" },
  done: { label: "انجام‌شده", color: "#10b981" },
};

// ─── Row / tooltip types (strict, no `any`) ─────────────────────────

interface MonthlyRow { key: string; month: string; revenue: number; newDeals: number }
interface StageRow { stage: string; name: string; count: number; value: number }
interface SourceRow { source: string; count: number; value: number }
interface TopRow { name: string; value: number; deals: number }
interface Slice { name: string; value: number; color: string }

interface TipItem {
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
}
interface TipProps { active?: boolean; payload?: TipItem[]; label?: string | number }

// ─── Hooks & helpers ────────────────────────────────────────────────

/** شمارش متحرک اعداد با animate فریمر-موشن */
function useCountUp(value: number, duration = 1.2): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const controls = animate(fromRef.current, value, { duration, ease: EASE, onUpdate: (v) => setDisplay(v) });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration]);
  return display;
}

/** پالت نمودارها از CSS variables (--chart-1..5 + accent-aware) با fallback ثابت */
function useChartPalette(): string[] {
  const accent = useCrmStore((s) => s.accent);
  const [palette, setPalette] = useState<string[]>(PALETTE_FALLBACK);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const cs = getComputedStyle(document.documentElement);
        const vars = [1, 2, 3, 4, 5, 6].map((i) => cs.getPropertyValue(`--chart-${i}`).trim());
        setPalette(vars.map((v, i) => (v ? v : PALETTE_FALLBACK[i])));
      } catch {
        setPalette(PALETTE_FALLBACK);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [accent]);
  return palette;
}

/** مقدار فقط-کلاینت (جلوگیری از hydration mismatch تاریخ امروز) */
function useClientOnly(fn: () => string): string {
  return useSyncExternalStore(
    useCallback(() => () => {}, []),
    fn,
    useCallback(() => "", [])
  );
}

/** مبلغ فشرده برای محورها: ۲.۵ میلیارد / ۸۵۰ م */
function compactMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${faNum(Math.round((n / 1_000_000_000) * 10) / 10)} میلیارد`;
  if (abs >= 1_000_000) return `${faNum(Math.round(n / 1_000_000))} م`;
  if (abs >= 1_000) return `${faNum(Math.round(n / 1_000))} هـ`;
  return faNum(n);
}

function activityTypeColor(key: string): string {
  return ACTIVITY_TYPES.find((t) => t.key === key)?.color ?? "#8b5cf6";
}

/** «۳ ساعت پیش» با رقم فارسی */
function relativeHours(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "چند دقیقه پیش";
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  return `${faNum(Math.floor(h / 24))} روز پیش`;
}

function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-md", className)} />;
}

/** رندر ساده‌ی متن تحلیل: خط با «- » → آیتم فهرست، **x** → strong */
function renderAnalysis(text: string): ReactNode[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((raw, i) => {
      const isItem = /^- /.test(raw);
      const parts = raw
        .replace(/^- /, "")
        .split(/(\*\*[^*]+\*\*)/g)
        .map((p, j) =>
          p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
            <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{p}</span>
          )
        );
      return isItem ? (
        <div key={i} className="flex items-start gap-2">
          <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary/70" />
          <span>{parts}</span>
        </div>
      ) : (
        <p key={i}>{parts}</p>
      );
    });
}

// ─── Shared UI atoms ────────────────────────────────────────────────

function MiniRing({ pct }: { pct: number }) {
  const r = 15, c = 2 * Math.PI * r, p = Math.min(100, Math.max(0, pct));
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--secondary)" strokeWidth="4" />
      <motion.circle
        cx="22" cy="22" r={r} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - p / 100) }} transition={{ duration: 1.2, ease: EASE }}
      />
    </svg>
  );
}

interface KpiDef {
  key: string;
  title: string;
  icon: LucideIcon;
  value: number;
  fmt: (n: number) => string;
  sub?: { text: string; destructive?: boolean };
  ring?: number;
  section: Section;
}

function KpiCard({ def, index }: { def: KpiDef; index: number }) {
  const navigate = useCrmStore((s) => s.navigate);
  const v = useCountUp(def.value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.1 + index * 0.04 }}
    >
      <Card
        role="button" tabIndex={0} aria-label={def.title}
        onClick={() => navigate(def.section)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(def.section); }
        }}
        className="group cursor-pointer gap-3 rounded-xl px-5 py-5 shadow-sm outline-none transition-colors hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">{def.title}</span>
          {def.ring !== undefined ? (
            <span className="relative flex items-center justify-center">
              <MiniRing pct={def.ring} />
              <def.icon className="absolute size-3.5 text-primary" aria-hidden />
            </span>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <def.icon className="size-4" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="tnum text-2xl font-bold tracking-tight">{def.fmt(v)}</span>
          {def.sub ? (
            <Badge variant="outline" className={cn("rounded-md text-[11px]", def.sub.destructive && "border-destructive/30 bg-destructive/10 text-destructive")}>
              {def.sub.text}
            </Badge>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

function ChartCard({
  title, desc, action, children, className, delay = 0,
}: {
  title: string; desc?: string; action?: ReactNode; children: ReactNode; className?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }} className={className}
    >
      <Card className="h-full gap-4 rounded-xl py-5 shadow-sm">
        <CardHeader className="px-5">
          <CardTitle className="text-[15px]">{title}</CardTitle>
          {desc ? <CardDescription className="text-xs">{desc}</CardDescription> : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
        <CardContent className="px-5">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Recharts tooltips (Persian) ────────────────────────────────────

function SalesTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="min-w-[160px] space-y-1.5 rounded-xl border bg-popover/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="font-semibold">{typeof label === "string" ? label : ""}</div>
      {payload.map((p, i) => {
        const isRevenue = p.dataKey === "revenue";
        return (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
              {isRevenue ? "فروش" : "فرصت جدید"}
            </span>
            <span className="tnum font-medium">{isRevenue ? faMoneyFull(Number(p.value ?? 0)) : faNum(Number(p.value ?? 0))}</span>
          </div>
        );
      })}
    </div>
  );
}

function StageDonutTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { name: string; value: number; count: number } | undefined;
  return (
    <div dir="rtl" className="space-y-0.5 rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{row?.name ?? payload[0].name}</div>
      <div className="text-muted-foreground">{faMoneyFull(Number(row?.value ?? 0))}</div>
      <div className="text-muted-foreground">{faNum(Number(row?.count ?? 0))} فرصت</div>
    </div>
  );
}

function StageBarTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as StageRow | undefined;
  return (
    <div dir="rtl" className="space-y-0.5 rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{row?.name ?? payload[0].name}</div>
      <div className="text-muted-foreground">{faMoneyFull(Number(row?.value ?? 0))}</div>
      <div className="text-muted-foreground">{faNum(Number(row?.count ?? 0))} فرصت</div>
    </div>
  );
}

function TopCustomerTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as TopRow | undefined;
  return (
    <div dir="rtl" className="space-y-0.5 rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{row?.name ?? payload[0].name}</div>
      <div className="text-muted-foreground">{faMoneyFull(Number(row?.value ?? 0))}</div>
      <div className="text-muted-foreground">{faNum(Number(row?.deals ?? 0))} فرصت فعال</div>
    </div>
  );
}

function SourceTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as SourceRow | undefined;
  return (
    <div dir="rtl" className="space-y-0.5 rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{row?.source ?? payload[0].name}</div>
      <div className="text-muted-foreground">{faNum(Number(row?.count ?? 0))} فرصت</div>
      <div className="text-muted-foreground">{faMoneyFull(Number(row?.value ?? 0))}</div>
    </div>
  );
}

function SliceTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { name: string; value: number } | undefined;
  return (
    <div dir="rtl" className="rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{row?.name ?? payload[0].name}</div>
      <div className="text-muted-foreground">{faNum(Number(row?.value ?? 0))} مورد</div>
    </div>
  );
}

// ─── Donut با برچسب مرکزی + فهرست ───────────────────────────────────

function MiniDonut({ slices, centerLabel, centerValue }: { slices: Slice[]; centerLabel: string; centerValue: string }) {
  const visible = slices.filter((s) => s.value > 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div dir="ltr" className="relative h-[170px] w-[170px] shrink-0">
        <ResponsiveContainer width="100%" height={170}>
          <PieChart>
            <Tooltip content={<SliceTooltip />} />
            <Pie data={visible} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={3} strokeWidth={0} cornerRadius={5} animationDuration={900}>
              {visible.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div dir="rtl" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tnum text-lg font-bold">{centerValue}</span>
          <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-2 text-xs">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
            <span className="tnum font-medium">{faNum(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── دونات قیف فروش با لجند قابل کلیک ───────────────────────────────

function StageDonut({ rows }: { rows: StageRow[] }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const visible = rows.filter((r) => r.value > 0 && !hidden[r.stage]);
  const total = visible.reduce((s, r) => s + r.value, 0);
  const toggle = (stage: string) => setHidden((h) => ({ ...h, [stage]: !h[stage] }));
  return (
    <div>
      <div dir="ltr" className="relative mx-auto h-[240px] w-full max-w-[300px]">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Tooltip content={<StageDonutTooltip />} />
            <Pie data={visible} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} strokeWidth={0} cornerRadius={6} animationDuration={1000}>
              {visible.map((r) => <Cell key={r.stage} fill={stageColor(r.stage)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div dir="rtl" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground">ارزش کل</span>
          <span className="tnum text-lg font-bold">{faMoney(total)}</span>
          <span className="text-[11px] text-muted-foreground">{faNum(visible.length)} مرحله فعال</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {rows.map((r) => (
          <button
            key={r.stage} type="button" onClick={() => toggle(r.stage)}
            aria-pressed={!hidden[r.stage]} aria-label={`${hidden[r.stage] ? "نمایش" : "پنهان"} مرحله ${r.name}`}
            className={cn("flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs transition-colors", hidden[r.stage] ? "opacity-40" : "hover:bg-accent/50")}
          >
            <span aria-hidden className="size-2 rounded-full" style={{ background: stageColor(r.stage) }} />
            <span>{r.name}</span>
            <span className="tnum text-muted-foreground">({faNum(r.count)})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton (هم‌چیدمان با حالت اصلی) ──────────────────────────────

function DashboardSkeleton() {
  const kpi = Array.from({ length: 6 });
  const charts = Array.from({ length: 4 });
  const lists = Array.from({ length: 2 });
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" aria-busy="true" aria-label="در حال بارگذاری داشبورد">
      <Shimmer className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpi.map((_, i) => (
          <Card key={i} className="gap-3 rounded-xl px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Shimmer className="h-3.5 w-20" />
              <Shimmer className="size-9 rounded-lg" />
            </div>
            <Shimmer className="h-7 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-xl py-5 shadow-sm lg:col-span-2">
          <CardContent className="space-y-4 px-5">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-[280px] w-full" />
          </CardContent>
        </Card>
        {charts.map((_, i) => (
          <Card key={i} className="rounded-xl py-5 shadow-sm">
            <CardContent className="space-y-4 px-5">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-[240px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lists.map((_, i) => (
          <Card key={i} className="rounded-xl py-5 shadow-sm">
            <CardContent className="space-y-3 px-5">
              <Shimmer className="h-4 w-28" />
              {Array.from({ length: 5 }).map((_, j) => <Shimmer key={j} className="h-10 w-full" />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="w-full max-w-md">
        <Card className="items-center gap-4 rounded-xl p-8 text-center shadow-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="font-semibold">خطا در بارگذاری داشبورد</h2>
            <p className="text-sm text-muted-foreground">دریافت داده‌ها ناموفق بود. اتصال خود را بررسی کنید و دوباره تلاش کنید.</p>
          </div>
          <Button onClick={onRetry} className="min-h-11 rounded-xl">
            <RefreshCw className="size-4" aria-hidden />
            تلاش مجدد
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export default function DashboardModule() {
  const navigate = useCrmStore((s) => s.navigate);
  const palette = useChartPalette();
  const today = useClientOnly(() => faDateLong(new Date()));

  const { data, isLoading, isError, isFetching, refetch } = useQuery<DashboardDto>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("dashboard fetch failed");
      return r.json() as Promise<DashboardDto>;
    },
    refetchInterval: 60000,
  });

  // ── تحلیل هوشمند (GET /api/ai/insights) ──
  const [aiOpen, setAiOpen] = useState(false);
  const ai = useQuery<{ analysis: string }>({
    queryKey: ["ai-insights"],
    enabled: aiOpen,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const r = await fetch("/api/ai/insights");
      if (!r.ok) throw new Error("ai insights failed");
      return r.json() as Promise<{ analysis: string }>;
    },
  });
  useEffect(() => {
    if (ai.isError) toast.error("تحلیل هوشمند موقتاً در دسترس نیست. بعداً تلاش کنید.");
  }, [ai.isError]);

  const openAnalysis = useCallback(() => {
    setAiOpen(true);
    if (ai.data) void ai.refetch();
  }, [ai]);

  // ── مشتقات نمودارها ──
  const monthlyRows = useMemo<MonthlyRow[]>(
    () => (data?.monthly ?? []).map((m) => ({ key: m.key, month: faMonth(`${m.key}-01`), revenue: m.revenue, newDeals: m.newDeals })),
    [data]
  );
  const stageRows = useMemo<StageRow[]>(
    () => (data?.stageStats ?? []).map((s) => ({ stage: s.stage, name: stageLabel(s.stage), count: s.count, value: s.value })),
    [data]
  );
  const sourceRows = useMemo<SourceRow[]>(
    () => (data?.sources ?? []).map((s) => ({ source: s.source, count: s.count, value: s.value })),
    [data]
  );
  const topRows = useMemo<TopRow[]>(() => data?.topCustomers ?? [], [data]);
  const taskSlices = useMemo<Slice[]>(
    () =>
      (data?.taskStats ?? []).map((t, i) => ({
        name: TASK_STATUS_META[t.status]?.label ?? t.status,
        value: t.count,
        color: TASK_STATUS_META[t.status]?.color ?? PALETTE_FALLBACK[i % PALETTE_FALLBACK.length],
      })),
    [data]
  );
  const activitySlices = useMemo<Slice[]>(
    () => (data?.activityTypes ?? []).map((a) => ({ name: activityTypeLabel(a.type), value: a.count, color: activityTypeColor(a.type) })),
    [data]
  );

  const exportCsv = useCallback(() => {
    if (!data) return;
    const lines = ["month,revenue,newDeals,activities"];
    for (const m of data.monthly) lines.push([m.key, String(m.revenue), String(m.newDeals), String(m.activities)].join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roudin-sales-trend-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("فایل CSV با موفقیت دانلود شد");
  }, [data]);

  if (isError && !data) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading || !data) return <DashboardSkeleton />;

  const d = data;
  const kpis: KpiDef[] = [
    { key: "customers", title: "مشتریان فعال", icon: Users, value: d.kpis.activeCustomers, fmt: (n) => faNum(Math.round(n)),
      sub: { text: `${faNum(Math.max(0, d.kpis.customers - d.kpis.activeCustomers))} سرنخ` }, section: "customers" },
    { key: "pipeline", title: "ارزش قیف باز", icon: Briefcase, value: d.kpis.pipelineValue, fmt: (n) => faMoney(n),
      sub: { text: `${faNum(d.kpis.openDeals)} فرصت` }, section: "deals" },
    { key: "revenue", title: "فروش ماه جاری", icon: TrendingUp, value: d.kpis.monthlyRevenue, fmt: (n) => faMoney(n), section: "reports" },
    { key: "conversion", title: "نرخ تبدیل", icon: Percent, value: d.kpis.conversionRate, fmt: (n) => faPercent(n), ring: d.kpis.conversionRate, section: "reports" },
    { key: "tasks", title: "وظایف باز", icon: ListTodo, value: d.kpis.openTasks, fmt: (n) => faNum(Math.round(n)),
      sub: d.kpis.overdueTasks > 0 ? { text: `${faNum(d.kpis.overdueTasks)} فوری`, destructive: true } : undefined, section: "tasks" },
    { key: "quotes", title: "پیش‌فاکتورهای فعال", icon: FileText, value: d.kpis.quotesSent, fmt: (n) => faNum(Math.round(n)), section: "quotes" },
  ];

  const useRadar = sourceRows.length >= 3;
  const totalTopDeals = topRows.reduce((s, t) => s + t.deals, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6">
      {/* ── ۱. هیرو ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
        className="relative overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div aria-hidden className="absolute inset-0 bg-gradient-to-l from-primary/10 via-transparent to-transparent" />
        <div aria-hidden className="orb size-72 bg-primary/25" style={{ top: "-110px", right: "8%" }} />
        <div aria-hidden className="orb orb-2 size-56 bg-primary/15" style={{ bottom: "-120px", left: "22%" }} />
        <div aria-hidden className="orb orb-3 size-40" style={{ top: "-40px", left: "45%", background: palette[2], opacity: 0.16 }} />
        <div className="relative z-10 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden className="pulse-dot inline-flex size-2 rounded-full bg-success" />
              {today || "—"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">داشبورد مدیریت</h1>
            <p className="text-sm text-muted-foreground">نمای کلی فروش، مشتریان و وظایف تیم — به‌روزرسانی خودکار هر ۶۰ ثانیه</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openAnalysis} className="min-h-11 rounded-xl">
              <Sparkles className="size-4" aria-hidden />
              تحلیل هوشمند
              {ai.isFetching ? <RefreshCw className="size-3.5 animate-spin opacity-70" aria-hidden /> : null}
            </Button>
            <Button variant="outline" size="icon" aria-label="به‌روزرسانی داده‌ها" onClick={() => void refetch()} className="size-11 rounded-xl">
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
            </Button>
          </div>
        </div>
      </motion.section>

      {/* ── ۲. پنل بینش‌ها + تحلیل هوشمند ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}>
        <Card className="gap-4 rounded-xl py-5 shadow-sm">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Sparkles className="size-4 text-primary" aria-hidden />
              تحلیل هوشمند
            </CardTitle>
            <CardDescription className="text-xs">نکات قانونی سیستم و تحلیل هوش مصنوعی از وضعیت فروش</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" onClick={openAnalysis} className="min-h-11 rounded-lg text-xs" aria-label="اجرای تحلیل هوشمند">
                {ai.data ? "تحلیل مجدد" : "اجرای تحلیل"}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4 px-5">
            {aiOpen && ai.isPending && !ai.data ? (
              <div className="space-y-2.5 rounded-xl border bg-muted/40 p-4" aria-busy="true">
                <Shimmer className="h-3.5 w-3/4" />
                <Shimmer className="h-3.5 w-full" />
                <Shimmer className="h-3.5 w-5/6" />
                <Shimmer className="h-3.5 w-2/3" />
              </div>
            ) : null}
            {ai.isError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4" aria-hidden />
                  تحلیل هوشمند در دسترس نیست. دوباره تلاش کنید.
                </span>
                <Button variant="outline" size="sm" onClick={() => void ai.refetch()} className="min-h-11 rounded-lg">
                  تلاش مجدد
                </Button>
              </div>
            ) : null}
            {ai.data ? (
              <div className={cn("space-y-1.5 rounded-xl border bg-muted/40 p-4 text-[13px] leading-7 text-muted-foreground transition-opacity", ai.isFetching && "opacity-60")}>
                {renderAnalysis(ai.data.analysis)}
              </div>
            ) : null}
            {!aiOpen ? (
              <p className="text-[13px] leading-6 text-muted-foreground">
                با دکمهٔ «تحلیل هوشمند»، هوش مصنوعی رودین وضعیت قیف فروش، وظایف و مشتریان شما را تحلیل می‌کند.
              </p>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              {d.insights.map((txt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE, delay: 0.12 + i * 0.05 }}
                  className="flex items-start gap-2.5 rounded-xl border bg-background/60 p-3 text-[13px] leading-6 text-muted-foreground"
                >
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{txt}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ── ۳. ردیف KPI ── */}
      <section aria-label="شاخص‌های کلیدی" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => <KpiCard key={k.key} def={k} index={i} />)}
      </section>

      {/* ── ۴. شبکه نمودارها ── */}
      <section aria-label="نمودارها" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="روند فروش و فعالیت"
          desc="۶ ماه اخیر — ارزش فرصت‌های برنده و فرصت‌های جدید"
          className="lg:col-span-2" delay={0.1}
          action={
            <Button variant="ghost" size="icon" aria-label="دانلود CSV روند فروش" onClick={exportCsv} className="size-11 rounded-xl">
              <Download className="size-4" aria-hidden />
            </Button>
          }
        >
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette[0]} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={palette[0]} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette[3]} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={palette[3]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
                <YAxis yAxisId="money" tickFormatter={(v: number) => compactMoney(v)} width={62} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" orientation="right" width={32} allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<SalesTooltip />} cursor={{ stroke: "var(--border)" }} />
                <Area yAxisId="money" type="monotone" dataKey="revenue" name="فروش" stroke={palette[0]} strokeWidth={2} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 4 }} animationDuration={1200} />
                <Area yAxisId="count" type="monotone" dataKey="newDeals" name="فرصت جدید" stroke={palette[3]} strokeWidth={2} fill="url(#gradDeals)" dot={false} activeDot={{ r: 4 }} animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-5 text-xs text-muted-foreground" dir="rtl">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: palette[0] }} />
              فروش
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: palette[3] }} />
              فرصت جدید
            </span>
          </div>
        </ChartCard>

        <ChartCard title="ترکیب قیف فروش" desc="ارزش فرصت‌ها به تفکیک مرحله — روی فهرست کلیک کنید" delay={0.14}>
          <StageDonut rows={stageRows} />
        </ChartCard>

        <ChartCard title="ارزش به تفکیک مرحله" desc="مجموع ارزش فرصت هر مرحله" delay={0.18}>
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stageRows} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} tickMargin={4} />
                <YAxis tickFormatter={(v: number) => compactMoney(v)} width={62} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<StageBarTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Bar dataKey="value" name="ارزش" radius={[8, 8, 0, 0]} maxBarSize={52} animationDuration={1100}>
                  {stageRows.map((r) => <Cell key={r.stage} fill={stageColor(r.stage)} />)}
                  <LabelList dataKey="value" position="top" fontSize={10} fill="var(--muted-foreground)" formatter={(v: unknown) => faMoney(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="مشتریان برتر"
          desc="بر اساس ارزش کل فرصت‌ها" delay={0.22}
          action={
            <Badge variant="secondary" className="rounded-md text-[11px]">{faNum(totalTopDeals)} فرصت</Badge>
          }
        >
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topRows} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<TopCustomerTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Bar dataKey="value" name="ارزش" radius={[6, 6, 6, 6]} maxBarSize={20} animationDuration={1100}>
                  {topRows.map((r, i) => <Cell key={r.name} fill={palette[i % palette.length]} />)}
                  <LabelList dataKey="value" position="right" fontSize={10} fill="var(--muted-foreground)" formatter={(v: unknown) => compactMoney(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="کانال‌های ورودی" desc={useRadar ? "توزیع فرصت‌ها بر اساس منبع" : "نمودار میله‌ای — تعداد کانال‌ها کم است"} delay={0.26}>
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              {useRadar ? (
                <RadarChart data={sourceRows} outerRadius="70%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="source" tick={AXIS_TICK} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar name="فرصت" dataKey="count" stroke={palette[4]} fill={palette[4]} fillOpacity={0.22} strokeWidth={2} animationDuration={1100} />
                  <Tooltip content={<SourceTooltip />} />
                </RadarChart>
              ) : (
                <BarChart data={sourceRows} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="source" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
                  <YAxis allowDecimals={false} width={32} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip content={<SourceTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="count" name="فرصت" radius={[8, 8, 0, 0]} maxBarSize={44} fill={palette[4]} animationDuration={1000}>
                    <LabelList dataKey="count" position="top" fontSize={10} fill="var(--muted-foreground)" />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="وضعیت وظایف" desc="توزیع وظایف بر اساس وضعیت" delay={0.3}>
          <MiniDonut slices={taskSlices} centerLabel="وظیفه" centerValue={faNum(taskSlices.reduce((s, x) => s + x.value, 0))} />
        </ChartCard>

        <ChartCard title="انواع فعالیت" desc="توزیع فعالیت‌های ثبت‌شده" delay={0.34}>
          <MiniDonut slices={activitySlices} centerLabel="فعالیت" centerValue={faNum(activitySlices.reduce((s, x) => s + x.value, 0))} />
        </ChartCard>
      </section>

      {/* ── ۵. دو ستون پایانی ── */}
      <section aria-label="فعالیت‌ها و وظایف" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.38 }}>
          <Card className="h-full gap-4 rounded-xl py-5 shadow-sm">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <History className="size-4 text-primary" aria-hidden />
                فعالیت‌های اخیر
              </CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" onClick={() => navigate("customers")} className="min-h-11 rounded-lg text-xs text-muted-foreground">
                  مشاهده همه
                  <ArrowLeft className="size-3.5" aria-hidden />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-5">
              {d.recentActivities.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">هنوز فعالیتی ثبت نشده است.</p>
              ) : (
                <div className="relative space-y-5 before:absolute before:bottom-2 before:right-[7px] before:top-2 before:w-px before:bg-border">
                  {d.recentActivities.map((a, i) => {
                    const color = activityTypeColor(a.type);
                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, ease: EASE, delay: 0.4 + i * 0.04 }}
                        className="relative pr-7"
                      >
                        <span aria-hidden className="absolute right-0 top-1 size-[15px] rounded-full border-2 bg-card" style={{ borderColor: color }} />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium leading-6">{a.title}</span>
                              <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />
                                {activityTypeLabel(a.type)}
                              </span>
                            </div>
                            {a.customer ? (
                              <button
                                type="button"
                                onClick={() => navigate("customers", { customerId: a.customer?.id ?? null })}
                                className="inline-flex min-h-11 items-center rounded-md px-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                              >
                                {a.customer.company}
                              </button>
                            ) : null}
                            {a.deal ? <span className="block text-[11px] text-muted-foreground">{a.deal.title}</span> : null}
                          </div>
                          <div className="shrink-0 space-y-0.5 text-left text-[11px] text-muted-foreground">
                            <div>{relativeHours(a.createdAt)}</div>
                            <div>{faDateLong(a.createdAt)}</div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.42 }}>
          <Card className="h-full gap-4 rounded-xl py-5 shadow-sm">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <ListTodo className="size-4 text-primary" aria-hidden />
                وظایف پیش‌رو
              </CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" onClick={() => navigate("tasks")} className="min-h-11 rounded-lg text-xs text-muted-foreground">
                  مشاهده همه
                  <ArrowLeft className="size-3.5" aria-hidden />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2 px-5">
              {d.upcomingTasks.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">وظیفه‌ای با سررسید پیش‌رو وجود ندارد.</p>
              ) : (
                d.upcomingTasks.map((t, i) => {
                  const due = faRelativeDue(t.dueDate);
                  const pc = priorityColor(t.priority);
                  return (
                    <motion.button
                      key={t.id} type="button" onClick={() => navigate("tasks")}
                      aria-label={`${t.title} — ${due.text}`}
                      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: EASE, delay: 0.44 + i * 0.04 }}
                      className="flex w-full items-center gap-3 rounded-xl border p-3 text-right shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span aria-hidden className="h-11 w-1 shrink-0 rounded-full" style={{ background: pc }} />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {t.customer ? <span>{t.customer.company}</span> : null}
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden className="size-1.5 rounded-full" style={{ background: pc }} />
                            {priorityLabel(t.priority)}
                          </span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-lg border px-2 py-1 text-[11px]",
                          due.overdue
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : due.soon
                              ? "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#b45309] dark:text-[#fbbf24]"
                              : "border-border bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {due.text}
                      </span>
                      {t.assignee ? (
                        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: `${t.assignee.color}26`, color: t.assignee.color }}>
                          {t.assignee.name.trim().charAt(0)}
                        </span>
                      ) : (
                        <span aria-hidden className="size-9 shrink-0 rounded-full border border-dashed" />
                      )}
                    </motion.button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </div>
  );
}
