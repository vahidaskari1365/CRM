import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        deals: { orderBy: { updatedAt: "desc" } },
        activity: { include: { user: { select: { id: true, name: true, color: true } }, deal: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
        tasks: { include: { assignee: true }, orderBy: { dueDate: "asc" } },
        quotes: { orderBy: { createdAt: "desc" } },
        _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } },
      },
    });
    if (!customer) return NextResponse.json({ error: "مشتری یافت نشد" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت مشتری" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const customer = await db.customer.update({ where: { id }, data: body });
    return NextResponse.json(customer);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش مشتری" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.customer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف مشتری" }, { status: 500 });
  }
}
