import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const k of ["title", "stage", "source", "description"]) if (k in body) data[k] = body[k];
    if ("value" in body) data.value = Number(body.value) || 0;
    if ("probability" in body) data.probability = Number(body.probability) || 0;
    if ("customerId" in body) data.customerId = body.customerId;
    if ("expectedClose" in body) data.expectedClose = body.expectedClose ? new Date(body.expectedClose) : null;
    const deal = await db.deal.update({ where: { id }, data, include: { customer: { select: { id: true, company: true, name: true } } } });
    return NextResponse.json(deal);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش فرصت" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.deal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف فرصت" }, { status: 500 });
  }
}
