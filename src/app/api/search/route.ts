import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ customers: [], deals: [], tasks: [], quotes: [] });

    const [customers, deals, tasks, quotes] = await Promise.all([
      db.customer.findMany({ where: { OR: [{ company: { contains: q } }, { name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] }, take: 5, select: { id: true, company: true, name: true, phone: true } }),
      db.deal.findMany({ where: { title: { contains: q } }, take: 5, include: { customer: { select: { company: true } } } }),
      db.task.findMany({ where: { title: { contains: q } }, take: 5, include: { customer: { select: { company: true } } } }),
      db.quote.findMany({ where: { number: { contains: q } }, take: 5, include: { customer: { select: { company: true } } } }),
    ]);
    return NextResponse.json({ customers, deals, tasks, quotes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در جستجو" }, { status: 500 });
  }
}
