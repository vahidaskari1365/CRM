import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const customer = await ds.getCustomer(id);
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
    const ds = await dataService();
    const body = await req.json();
    const customer = await ds.updateCustomer(id, body);
    if (!customer) return NextResponse.json({ error: "مشتری یافت نشد" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش مشتری" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    await ds.deleteCustomer(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف مشتری" }, { status: 500 });
  }
}
