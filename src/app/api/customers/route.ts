import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const status = searchParams.get("status") ?? "";
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
            { industry: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {};
    const statusWhere = status ? { ...where, status } : where;
    const customers = await db.customer.findMany({
      where: statusWhere,
      include: { _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(customers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت مشتریان" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.company || !body.phone) {
      return NextResponse.json({ error: "نام، شرکت و تلفن الزامی است" }, { status: 400 });
    }
    const customer = await db.customer.create({ data: { ...body, createdAt: new Date() } });
    return NextResponse.json(customer, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد مشتری" }, { status: 500 });
  }
}
