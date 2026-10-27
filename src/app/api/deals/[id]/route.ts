import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const body = await req.json();
    const deal = await ds.updateDeal(id, {
      ...(body.expectedClose !== undefined ? { expectedClose: body.expectedClose ? new Date(body.expectedClose) : null } : {}),
      ...body,
    });
    if (!deal) return NextResponse.json({ error: "فرصت یافت نشد" }, { status: 404 });
    return NextResponse.json(deal);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش فرصت" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    await ds.deleteDeal(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف فرصت" }, { status: 500 });
  }
}
