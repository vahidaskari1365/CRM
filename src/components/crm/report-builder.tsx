"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart3, PieChart as PieIcon, LineChart as LineIcon, Radar as RadarIcon,
  AreaChart as AreaIcon, Download, Printer, Wand2, Table2, Filter, Loader2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ReportRequest, ReportResponse } from "@/lib/types";
import { faNum, faMoney, faMoneyFull } from "@/lib/format";

const PALETTE = ["#8b5cf6", "#f59e0b", "#10b981", "#f97316", "#ec4899", "#06b6d4", "#a855f7", "#84cc16", "#ef4444", "#14b8a6"];

const ENTITIES = [
  { key: "deals", label: "فرصت‌های فروش" },
  { key: "customers", label: "مشتریان" },
  { key: "tasks", label: "وظایف" },
  { key: "quotes", label: "پیش‌فاکتورها" },
  { key: "activities", label: "فعالیت‌ها" },
] as const;

const GROUP_BYS: Record<string, { key: string; label: string }[]> = {
  deals: [
    { key: "stage", label: "مرحله فروش" },
    { key: "source", label: "کانال ورودی" },
    { key: "month", label: "ماه ایجاد" },
    { key: "customer", label: "مشتری" },
    { key: "valueRange", label: "بازه ارزش" },
  ],
  customers: [
    { key: "status", label: "وضعیت" },
    { key: "industry", label: "صنعت" },
    { key: "city", label: "شهر" },
    { key: "month", label: "ماه ثبت" },
  ],
  tasks: [
    { key: "status", label: "وضعیت" },
    { key: "priority", label: "اولویت" },
    { key: "assignee", label: "مسئول" },
    { key: "dueMonth", label: "ماه سررسید" },
  ],
  quotes: [
    { key: "status", label: "وضعیت" },
    { key: "month", label: "ماه صدور" },
    { key: "customer", label: "مشتری" },
  ],
  activities: [
    { key: "type", label: "نوع فعالیت" },
    { key: "month", label: "ماه" },
    { key: "customer", label: "مشتری" },
    { key: "userName", label: "کاربر" },
  ],
};

const METRICS: Record<string, { key: string; label: string }[]> = {
  deals: [
    { key: "count", label: "تعداد فرصت" },
    { key: "sum_value", label: "جمع ارزش (تومان)" },
  ],
  customers: [{ key: "count", label: "تعداد مشتری" }],
  tasks: [{ key: "count", label: "تعداد وظیفه" }],
  quotes: [
    { key: "count", label: "تعداد پیش‌فاکتور" },
    { key: "sum_total", label: "جمع مبلغ (تومان)" },
  ],
  activities: [{ key: "count", label: "تعداد فعالیت" }],
};

const CHART_TYPES = [
  { key: "bar", label: "ستونی", icon: BarChart3 },
  { key: "line", label: "خطی", icon: LineIcon },
  { key: "pie", label: "دایره‌ای", icon: PieIcon },
  { key: "area", label: "ناحیه‌ای", icon: AreaIcon },
  { key: "radar", label: "راداری", icon: RadarIcon },
] as const;

const TEMPLATES: { title: string; emoji: string; req: Omit<ReportRequest, "title"> }[] = [
  { title: "قیف فروش به تفکیک مرحله", emoji: "🎯", req: { entity: "deals", groupBy: "stage", metric: "count", chartType: "bar" } },
  { title: "ارزش فرصت‌ها بر اساس کانال ورودی", emoji: "📡", req: { entity: "deals", groupBy: "source", metric: "sum_value", chartType: "pie" } },
  { title: "روند ماهانه ارزش فروش", emoji: "📈", req: { entity: "deals", groupBy: "month", metric: "sum_value", chartType: "area" } },
  { title: "سهم صنایع از مشتریان", emoji: "🏭", req: { entity: "customers", groupBy: "industry", metric: "count", chartType: "pie" } },
  { title: "توزیع وظایف بین اعضای تیم", emoji: "👥", req: { entity: "tasks", groupBy: "assignee", metric: "count", chartType: "radar" } },
  { title: "وظایف عقب‌افتاده به تفکیک مسئول", emoji: "⏰", req: { entity: "tasks", groupBy: "assignee", metric: "count", chartType: "bar", filters: [{ field: "status", value: "todo" }] } },
  { title: "ارزش پیش‌فاکتورها به تفکیک مشتری", emoji: "🧾", req: { entity: "quotes", groupBy: "customer", metric: "sum_total", chartType: "bar" } },
  { title: "فعالیت‌ها بر اساس نوع", emoji: "📞", req: { entity: "activities", groupBy: "type", metric: "count", chartType: "donut" as never } },
];

export default function ReportBuilderModule() {
  const [entity, setEntity] = useState<ReportRequest["entity"]>("deals");
  const [groupBy, setGroupBy] = useState("stage");
  const [metric, setMetric] = useState("count");
  const [chartType, setChartType] = useState<ReportRequest["chartType"]>("bar");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: productsHint } = useQuery<{ id: string; name: string }[]>({ queryKey: ["products"], queryFn: async () => (await fetch("/api/products")).json() });

  const generate = async (override?: Partial<ReportRequest>) => {
    setLoading(true);
    try {
      const req: ReportRequest = {
        entity: override?.entity ?? entity,
        groupBy: override?.groupBy ?? (override?.entity ? GROUP_BYS[override.entity][0].key : groupBy),
        metric: override?.metric ?? (override?.entity ? METRICS[override.entity][0].key : metric),
        chartType: override?.chartType ?? chartType,
        filters:
          filterField && filterValue
            ? [{ field: filterField, value: filterValue }]
            : override?.filters ?? [],
        title: title || undefined,
      };
      const r = await fetch("/api/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setResult(await r.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در تولید گزارش");
    } finally {
      setLoading(false);
    }
  };

  const rows = result?.rows ?? [];
  const isMoney = metric.startsWith("sum_");
  const fmtVal = (v: number) => (isMoney ? faMoney(v) : faNum(v));

  const exportCsv = () => {
    if (!result) return;
    const header = "label,value\n";
    const body = rows.map((r) => `${r.label.replace(/,/g, "،")},${r.value}`).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.title}.csv`;
    a.click();
    toast.success("خروجی CSV دانلود شد");
  };

  const chartData = useMemo(() => rows.map((r) => ({ name: r.label, value: r.value })), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">گزارش‌ساز گرافیکی</h1>
          <p className="text-sm text-muted-foreground mt-1">
            گزارش‌های دلخواه خود را بسازید — هر گزارش با نمودار، جدول و خروجی
          </p>
        </div>
      </div>

      {/* Templates */}
      <div>
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
          <Wand2 className="size-4" /> گزارش‌های آماده (یک کلیک)
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t, i) => (
            <motion.button
              key={t.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => {
                setEntity(t.req.entity);
                setGroupBy(GROUP_BYS[t.req.entity][0].key);
                setMetric(METRICS[t.req.entity][0].key);
                setChartType(t.req.chartType === ("donut" as never) ? "pie" : t.req.chartType);
                setTitle(t.title);
                setFilterField(t.req.filters?.[0]?.field ?? "");
                setFilterValue(t.req.filters?.[0]?.value ?? "");
                generate({ ...t.req, chartType: t.req.chartType === ("donut" as never) ? "pie" : t.req.chartType });
              }}
              className="min-h-11 rounded-xl border bg-card px-4 text-sm hover:bg-accent hover:border-primary/40 transition-all hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>{t.emoji}</span> {t.title}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Builder */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="size-4 text-primary" /> ساخت گزارش دلخواه
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">منبع داده</Label>
              <Select value={entity} onValueChange={(v) => { const e = v as ReportRequest["entity"]; setEntity(e); setGroupBy(GROUP_BYS[e][0].key); setMetric(METRICS[e][0].key); }}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITIES.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">گروه‌بندی بر اساس</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(GROUP_BYS[entity] ?? []).map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">سنجه</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(METRICS[entity] ?? []).map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">فیلتر اختیاری</Label>
              <div className="flex gap-1">
                <Input placeholder="فیلد" dir="ltr" className="min-h-11 text-xs" value={filterField} onChange={(e) => setFilterField(e.target.value)} />
                <Input placeholder="مقدار" className="min-h-11 text-xs" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان گزارش</Label>
              <Input placeholder="مثلاً: گزارش فروش فصل" className="min-h-11" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {CHART_TYPES.map((ct) => (
                <Button
                  key={ct.key}
                  variant={chartType === ct.key ? "default" : "outline"}
                  size="sm"
                  className="min-h-11 gap-1.5"
                  onClick={() => setChartType(ct.key)}
                >
                  <ct.icon className="size-4" /> {ct.label}
                </Button>
              ))}
            </div>
            <Button className="min-h-11 gap-2" onClick={() => generate()} disabled={loading} aria-label="تولید گزارش">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <BarChart3 className="size-4" />}
              تولید گزارش
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" exit={{ opacity: 0 }} className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="lg:col-span-2 h-[380px] rounded-xl" />
            <Skeleton className="h-[380px] rounded-xl" />
          </motion.div>
        )}
        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{result.title}</h2>
                <Badge variant="secondary">{fmtVal(result.total)} مجموع</Badge>
                <Badge variant="outline" className="text-xs">
                  {ENTITIES.find((e) => e.key === result.entity)?.label} / {(GROUP_BYS[result.entity] ?? []).find((g) => g.key === result.groupBy)?.label ?? result.groupBy}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={exportCsv}>
                  <Download className="size-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={() => window.print()}>
                  <Printer className="size-4" /> چاپ
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 items-start print-area">
              {/* Chart */}
              <Card className="lg:col-span-2 border-border/70">
                <CardContent className="p-4">
                  <div dir="ltr" className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={chartData} margin={{ top: 24, left: 8, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} angle={chartData.length > 5 ? -18 : 0} textAnchor={chartData.length > 5 ? "end" : "middle"} height={chartData.length > 5 ? 52 : 30} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => (isMoney ? `${Math.round(v / 1e6)}` : String(v))} />
                          <Tooltip
                            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl" }}
                            formatter={(v) => [isMoney ? faMoneyFull(Number(v)) : faNum(Number(v)), ""]}
                            labelFormatter={(l) => String(l)}
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={52}>
                            {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                          </Bar>
                        </BarChart>
                      ) : chartType === "line" ? (
                        <LineChart data={chartData} margin={{ top: 24, left: 8, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => (isMoney ? `${Math.round(v / 1e6)}` : String(v))} />
                          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl" }} formatter={(v) => [isMoney ? faMoneyFull(Number(v)) : faNum(Number(v)), ""]} />
                          <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4, fill: "var(--chart-1)" }} activeDot={{ r: 6 }} />
                        </LineChart>
                      ) : chartType === "area" ? (
                        <AreaChart data={chartData} margin={{ top: 24, left: 8, right: 8 }}>
                          <defs>
                            <linearGradient id="rbArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => (isMoney ? `${Math.round(v / 1e6)}` : String(v))} />
                          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl" }} formatter={(v) => [isMoney ? faMoneyFull(Number(v)) : faNum(Number(v)), ""]} />
                          <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} fill="url(#rbArea)" />
                        </AreaChart>
                      ) : chartType === "radar" ? (
                        <RadarChart data={chartData} outerRadius="72%">
                          <PolarGrid stroke="var(--border)" />
                          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                          <PolarRadiusAxis tick={{ fontSize: 10 }} axisLine={false} />
                          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl" }} formatter={(v) => [isMoney ? faMoneyFull(Number(v)) : faNum(Number(v)), ""]} />
                          <Radar dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} />
                        </RadarChart>
                      ) : (
                        <PieChart>
                          <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, direction: "rtl" }} formatter={(v) => [isMoney ? faMoneyFull(Number(v)) : faNum(Number(v)), ""]} />
                          <Legend
                            formatter={(v: string) => <span style={{ color: "var(--foreground)", fontSize: 12 }}>{v}</span>}
                          />
                          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>
                            {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                          </Pie>
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Table2 className="size-4 text-primary" /> جزئیات</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>گروه</TableHead>
                          <TableHead className="text-left">مقدار</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <span className="flex items-center gap-2">
                                <span className="size-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                {r.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-left font-semibold">{fmtVal(r.value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !result && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <BarChart3 className="mx-auto size-10 mb-3 opacity-30" />
            یکی از گزارش‌های آماده را انتخاب کنید یا گزارش دلخواه بسازید
          </CardContent>
        </Card>
      )}
    </div>
  );
}
