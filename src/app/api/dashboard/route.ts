import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [customers, deals, tasks, quotes, activities, users] = await Promise.all([
      db.customer.findMany({ include: { _count: true } }),
      db.deal.findMany({ include: { customer: { select: { id: true, company: true, name: true } } } }),
      db.task.findMany({ include: { assignee: true, customer: { select: { id: true, company: true } } } }),
      db.quote.findMany(),
      db.activity.findMany({
        include: { customer: { select: { id: true, company: true } }, user: { select: { id: true, name: true, color: true } }, deal: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.user.findMany(),
    ]);

    const now = new Date();
    const openStages = ["lead", "qualified", "proposal", "negotiation"];
    const openDeals = deals.filter((d) => openStages.includes(d.stage));
    const wonDeals = deals.filter((d) => d.stage === "won");
    const lostDeals = deals.filter((d) => d.stage === "lost");
    const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
    const wonValue = wonDeals.reduce((s, d) => s + d.value, 0);
    const conversionRate = wonDeals.length + lostDeals.length > 0 ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 : 0;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const openTasks = tasks.filter((t) => t.status !== "done");
    const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);
    const dueSoonTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= in3);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = wonDeals.filter((d) => new Date(d.updatedAt) >= thisMonthStart).reduce((s, d) => s + d.value, 0);
    const avgDealSize = openDeals.length ? pipelineValue / openDeals.length : 0;

    // stage stats
    const stageStats = openStages.concat(["won", "lost"]).map((stage) => {
      const list = deals.filter((d) => d.stage === stage);
      return { stage, count: list.length, value: list.reduce((s, d) => s + d.value, 0) };
    });

    // monthly series (6 months)
    const monthly: { key: string; revenue: number; newDeals: number; activities: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      monthly.push({
        key,
        revenue: wonDeals.filter((d) => { const dt = new Date(d.updatedAt); return dt >= start && dt < end; }).reduce((s, d) => s + d.value, 0),
        newDeals: deals.filter((d) => { const dt = new Date(d.createdAt); return dt >= start && dt < end; }).length,
        activities: activities.filter((a) => { const dt = new Date(a.createdAt); return dt >= start && dt < end; }).length,
      });
    }

    // top customers by deal value
    const byCustomer = new Map<string, { name: string; value: number; deals: number }>();
    for (const d of deals) {
      if (!d.customer) continue;
      const cur = byCustomer.get(d.customer.id) ?? { name: d.customer.company, value: 0, deals: 0 };
      cur.value += d.value;
      cur.deals += 1;
      byCustomer.set(d.customer.id, cur);
    }
    const topCustomers = [...byCustomer.values()].sort((a, b) => b.value - a.value).slice(0, 5);

    // sources
    const bySource = new Map<string, { count: number; value: number }>();
    for (const d of deals) {
      const k = d.source ?? "سایر";
      const cur = bySource.get(k) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += d.value;
      bySource.set(k, cur);
    }
    const sources = [...bySource.entries()].map(([source, v]) => ({ source, ...v }));

    // task + activity stats
    const taskStats = ["todo", "in_progress", "done"].map((status) => ({ status, count: tasks.filter((t) => t.status === status).length }));
    const activityTypes = ["call", "meeting", "email", "note"].map((type) => ({ type, count: activities.filter((a) => a.type === type).length }));

    // insights (قانون‌محور)
    const insights: string[] = [];
    if (pipelineValue > 0) {
      const topStage = stageStats.filter((s) => openStages.includes(s.stage)).sort((a, b) => b.value - a.value)[0];
      if (topStage) insights.push(`بیشترین ارزش قیف فروش در مرحله «${{ lead: "سرنخ", qualified: "واجد شرایط", proposal: "پیشنهاد قیمت", negotiation: "مذاکره" }[topStage.stage as keyof typeof topStage] ?? topStage.stage}» با ${topStage.count} فرصت متمرکز است.`);
    }
    insights.push(`نرخ تبدیل سرنخ به برنده ${Math.round(conversionRate)}٪ است؛ ${wonDeals.length} فرصت برنده و ${lostDeals.length} باخته ثبت شده.`);
    if (overdueTasks.length > 0) insights.push(`${overdueTasks.length} وظیفه از سررسید گذشته — توصیه می‌شود ابتدا این موارد پایش شوند.`);
    insights.push(`میانگین ارزش هر فرصت باز ${(avgDealSize / 1_000_000).toFixed(0)} میلیون تومان برآورد می‌شود.`);
    if (topCustomers[0]) insights.push(`بزرگ‌ترین مشتری بر اساس ارزش کل فرصت‌ها «${topCustomers[0].name}» است.`);
    const bestSource = sources.sort((a, b) => b.value - a.value)[0];
    if (bestSource) insights.push(`مؤثرترین کانال ورودی «${bestSource.source}» با ${bestSource.count} فرصت است.`);

    const upcomingTasks = openTasks
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 6);

    return NextResponse.json({
      kpis: {
        customers: customers.length,
        activeCustomers: customers.filter((c) => c.status === "active").length,
        openDeals: openDeals.length,
        pipelineValue,
        wonValue,
        wonCount: wonDeals.length,
        lostCount: lostDeals.length,
        conversionRate,
        overdueTasks: overdueTasks.length,
        dueSoonTasks: dueSoonTasks.length,
        openTasks: openTasks.length,
        quotesSent: quotes.filter((q) => q.status === "sent" || q.status === "approved").length,
        monthlyRevenue,
        avgDealSize,
      },
      stageStats,
      monthly,
      topCustomers,
      sources,
      taskStats,
      activityTypes,
      recentActivities: activities.slice(0, 8),
      upcomingTasks,
      insights,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت داده‌های داشبورد" }, { status: 500 });
  }
}
