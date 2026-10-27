import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";
import type { ReportRequest, ReportResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUP_LABELS: Record<string, Record<string, string>> = {
  deals: { lead: "سرنخ", qualified: "واجد شرایط", proposal: "پیشنهاد قیمت", negotiation: "مذاکره", won: "برنده", lost: "باخته" },
  tasks: { todo: "در انتظار", in_progress: "در حال انجام", done: "انجام‌شده", low: "کم", medium: "متوسط", high: "زیاد", urgent: "فوری" },
  activities: { call: "تماس", meeting: "جلسه", email: "ایمیل", note: "یادداشت" },
  customers: { active: "فعال", inactive: "غیرفعال", lead: "سرنخ" },
  quotes: { draft: "پیش‌نویس", sent: "ارسال‌شده", approved: "تأییدشده", rejected: "ردشده" },
};

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function monthLabel(d: Date): string {
  const m = d.getMonth();
  return `${MONTHS_FA[m]} ${new Intl.DateTimeFormat("fa-IR", { year: "2-digit" }).format(d)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReportRequest;
    const { entity, groupBy, metric } = body;
    const ds = await dataService();
    const raw = await ds.getDashboardRaw();

    type Row = Record<string, unknown>;
    let rows: Row[] = [];

    if (entity === "deals") {
      rows = raw.deals.map((d) => ({
        ...d,
        customerName: d.customer?.company ?? "—",
        industry: "—",
        createdAt: d.createdAt,
      }));
      // صنعت از مشتریان
      const indMap = new Map(raw.customers.map((c) => [c.id, c.industry ?? "—"]));
      rows = rows.map((r) => ({ ...r, industry: indMap.get(String(r.customerId)) ?? "—" }));
    } else if (entity === "customers") {
      rows = raw.customers.map((c) => ({
        ...c,
        dealCount: c._count.deals,
        activityCount: c._count.activity,
        createdAt: c.createdAt,
      }));
    } else if (entity === "tasks") {
      rows = raw.tasks.map((t) => ({
        ...t,
        assigneeName: t.assignee?.name ?? "—",
        customerName: t.customer?.company ?? "—",
        createdAt: t.createdAt,
        dueDate: t.dueDate,
      }));
    } else if (entity === "quotes") {
      rows = raw.quotes.map((q) => ({
        ...q,
        customerName: q.customer?.company ?? "—",
        createdAt: q.createdAt,
      }));
    } else {
      rows = raw.activities.map((a) => ({
        ...a,
        customerName: a.customer?.company ?? "—",
        userName: a.user?.name ?? "—",
        createdAt: a.createdAt,
      }));
    }

    // فیلترها
    for (const f of body.filters ?? []) {
      if (!f.field || !f.value) continue;
      rows = rows.filter((r) => String(r[f.field] ?? "") === f.value);
    }

    // گروه‌بندی
    const groups = new Map<string, { value: number; count: number }>();
    for (const r of rows) {
      let label: string;
      if (groupBy === "month") {
        label = monthLabel(new Date(r.createdAt as Date));
      } else if (groupBy === "dueMonth") {
        label = r.dueDate ? monthLabel(new Date(r.dueDate as Date)) : "بدون سررسید";
      } else if (groupBy === "customer" || groupBy === "customerName") {
        label = String(r.customerName ?? "—");
      } else if (groupBy === "assignee") {
        label = String(r.assigneeName ?? "—");
      } else if (groupBy === "userName") {
        label = String(r.userName ?? "—");
      } else if (groupBy === "valueRange") {
        const v = Number(r.value ?? 0);
        label = v >= 500_000_000 ? "+۵۰۰ میلیون" : v >= 200_000_000 ? "۲۰۰ تا ۵۰۰ میلیون" : v >= 100_000_000 ? "۱۰۰ تا ۲۰۰ میلیون" : "زیر ۱۰۰ میلیون";
      } else {
        const rawLabel = String(r[groupBy] ?? "—");
        label = GROUP_LABELS[entity]?.[rawLabel] ?? rawLabel;
      }
      const cur = groups.get(label) ?? { value: 0, count: 0 };
      cur.count += 1;
      if (metric === "sum_value") cur.value += Number(r.value ?? 0);
      else if (metric === "sum_total") cur.value += Number(r.total ?? 0);
      else if (metric === "sum_probability") cur.value += Number(r.probability ?? 0);
      else cur.value += 1;
      groups.set(label, cur);
    }

    const rowsOut = [...groups.entries()]
      .map(([label, g]) => ({ label, value: metric === "count" ? g.count : Math.round(g.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const res: ReportResponse = {
      title: body.title || `گزارش ${entity === "deals" ? "فرصت‌ها" : entity === "customers" ? "مشتریان" : entity === "tasks" ? "وظایف" : entity === "quotes" ? "پیش‌فاکتورها" : "فعالیت‌ها"}`,
      rows: rowsOut,
      total: rowsOut.reduce((s, r) => s + r.value, 0),
      entity,
      groupBy,
      metric,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(res);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در تولید گزارش" }, { status: 500 });
  }
}
