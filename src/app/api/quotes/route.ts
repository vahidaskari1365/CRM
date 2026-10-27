import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ds = await dataService();
    const quotes = await ds.listQuotes();
    return NextResponse.json(quotes);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت پیش‌فاکتورها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ds = await dataService();
    const body = await req.json();
    if (!body.customerId || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "مشتری و حداقل یک قلم کالا الزامی است" }, { status: 400 });
    }
    const quote = await ds.createQuote({
      customerId: body.customerId,
      status: body.status ?? "draft",
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      notes: body.notes ?? null,
      items: body.items,
      discountPercent: Number(body.discountPercent) || 0,
    });
    return NextResponse.json(quote, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد پیش‌فاکتور" }, { status: 500 });
  }
}
