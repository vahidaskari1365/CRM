import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeTotals } from "../route";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quote = await db.quote.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!quote) return NextResponse.json({ error: "پیش‌فاکتور یافت نشد" }, { status: 404 });
    return NextResponse.json(quote);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت پیش‌فاکتور" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const current = await db.quote.findUnique({ where: { id }, include: { items: true } });
    if (!current) return NextResponse.json({ error: "پیش‌فاکتور یافت نشد" }, { status: 404 });

    // تغییر وضعیت ساده
    if (body.status && !("items" in body)) {
      const updated = await db.quote.update({ where: { id }, data: { status: body.status } });
      return NextResponse.json(updated);
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "حداقل یک قلم کالا الزامی است" }, { status: 400 });
    }
    const { computed, subtotal, discount, tax, total } = computeTotals(body.items, Number(body.discountPercent) || 0);
    await db.quoteItem.deleteMany({ where: { quoteId: id } });
    const quote = await db.quote.update({
      where: { id },
      data: {
        customerId: body.customerId ?? current.customerId,
        status: body.status ?? current.status,
        validUntil: body.validUntil ? new Date(body.validUntil) : current.validUntil,
        notes: "notes" in body ? body.notes : current.notes,
        items: {
          create: computed.map((it) => ({
            productId: it.productId || null,
            name: it.name,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            discount: Number(it.discount) || 0,
            lineTotal: it.lineTotal,
          })),
        },
        subtotal,
        discount,
        tax,
        total,
      },
      include: { items: true, customer: true },
    });
    return NextResponse.json(quote);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش پیش‌فاکتور" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.quoteItem.deleteMany({ where: { quoteId: id } });
    await db.quote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف پیش‌فاکتور" }, { status: 500 });
  }
}
