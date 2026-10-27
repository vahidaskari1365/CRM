import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const quote = await ds.getQuote(id);
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
    const ds = await dataService();
    const body = await req.json();
    const quote = await ds.updateQuote(id, body);
    if (!quote) return NextResponse.json({ error: "پیش‌فاکتور یافت نشد" }, { status: 404 });
    return NextResponse.json(quote);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش پیش‌فاکتور" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    await ds.deleteQuote(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف پیش‌فاکتور" }, { status: 500 });
  }
}
