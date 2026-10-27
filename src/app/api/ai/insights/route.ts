import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** تحلیل هوش مصنوعی داده‌های CRM — تحلیل‌گر فروش رودین */
export async function GET() {
  try {
    const [deals, tasks, customers, quotes, activities] = await Promise.all([
      db.deal.findMany({ include: { customer: { select: { company: true } } } }),
      db.task.findMany({ include: { assignee: { select: { name: true } } } }),
      db.customer.findMany({ select: { id: true, status: true, industry: true } }),
      db.quote.findMany({ select: { status: true, total: true } }),
      db.activity.findMany({ select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    ]);

    const openStages = ["lead", "qualified", "proposal", "negotiation"];
    const summary = {
      مشتریان: { کل: customers.length, فعال: customers.filter((c) => c.status === "active").length, سرنخ: customers.filter((c) => c.status === "lead").length },
      صنایع_مشتریان: Object.entries(customers.reduce<Record<string, number>>((acc, c) => { const k = c.industry ?? "سایر"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})),
      فرصت‌ها: {
        کل: deals.length,
        به_تفکیک_مرحله: Object.entries(deals.reduce<Record<string, number>>((acc, d) => { acc[d.stage] = (acc[d.stage] ?? 0) + 1; return acc; }, {})),
        ارزش_قیف_باز: deals.filter((d) => openStages.includes(d.stage)).reduce((s, d) => s + d.value, 0),
        برنده: deals.filter((d) => d.stage === "won").length,
        باخته: deals.filter((d) => d.stage === "lost").length,
        کانال_ورودی: Object.entries(deals.reduce<Record<string, number>>((acc, d) => { const k = d.source ?? "سایر"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})),
      },
      وظایف: { کل: tasks.length, عقب‌افتاده: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length, براساس_وضعیت: Object.entries(tasks.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {})), براساس_مسئول: Object.entries(tasks.reduce<Record<string, number>>((acc, t) => { const k = t.assignee?.name ?? "بی‌مسئول"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})) },
      پیش_فاکتورها: { کل: quotes.length, تاییدشده: quotes.filter((q) => q.status === "approved").length, ارزش_کل: quotes.reduce((s, q) => s + q.total, 0) },
      فعالیت‌ها: { کل_۵۰۰_آخرین: activities.length, به_تفکیک_نوع: Object.entries(activities.reduce<Record<string, number>>((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {})) },
    };

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "تو تحلیل‌گر ارشد فروش و CRM شرکت رودین هستی. داده JSON خلاصه CRM را به فارسی روان و حرفه‌ای تحلیل کن. ساختار پاسخ: ۱) سه‌چهار نکته کلیدی و الگوهای مهم (با اعداد) ۲) دو سه ریسک یا هشدار ۳) سه توصیه اجرایی مشخص و اولویت‌دار. مختصر، مستقیم و قابل اقدام بنویس. از عناوین کوتاه با ** استفاده کن. فهرست با - بنویس. بیش از ۲۵۰ کلمه ننویس.",
        },
        { role: "user", content: JSON.stringify(summary) },
      ],
      thinking: { type: "disabled" },
    });

    const analysis = completion.choices[0]?.message?.content ?? "تحلیل در دسترس نیست.";
    return NextResponse.json({ analysis, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("AI insights error:", e);
    return NextResponse.json({ error: "تحلیل هوشمند در دسترس نیست. بعداً تلاش کنید." }, { status: 503 });
  }
}
