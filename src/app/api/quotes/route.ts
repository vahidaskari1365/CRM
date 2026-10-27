import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ItemInput {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

/** محاسبه اقلام و جمع‌ها */
export function computeTotals(items: ItemInput[], overallDiscountPercent: number) {
  const computed = items.map((it) => {
    const lineTotal = Math.round(it.quantity * it.unitPrice * (1 - (it.discount ?? 0) / 100));
    return { ...it, lineTotal };
  });
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const afterLines = computed.reduce((s, it) => s + it.lineTotal, 0);
  const discount = Math.round((afterLines * (overallDiscountPercent ?? 0)) / 100);
  const tax = Math.round((afterLines - discount) * 0.1); // مالیات ارزش افزوده ۱۰٪
  const total = afterLines - discount + tax;
  return { computed, subtotal, discount, tax, total };
}

async function nextQuoteNumber(): Promise<string> {
  const count = await db.quote.count();
  const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date()).replace(/\D/g, "");
  return `RF-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function GET() {
  try {
    const quotes = await db.quote.findMany({
      include: { customer: { select: { id: true, company: true, name: true, phone: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(quotes);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت پیش‌فاکتورها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.customerId || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "مشتری و حداقل یک قلم کالا الزامی است" }, { status: 400 });
    }
    const { computed, subtotal, discount, tax, total } = computeTotals(body.items, Number(body.discountPercent) || 0);
    const quote = await db.quote.create({
      data: {
        number: await nextQuoteNumber(),
        customerId: body.customerId,
        status: body.status ?? "draft",
        validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 30 * 86400000),
        notes: body.notes ?? null,
        items: {
          create: computed.map((it: ItemInput & { lineTotal: number }) => ({
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
    return NextResponse.json(quote, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد پیش‌فاکتور" }, { status: 500 });
  }
}
