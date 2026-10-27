import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const wf = await ds.getWorkflow(id);
    if (!wf) return NextResponse.json({ error: "فرآیند یافت نشد" }, { status: 404 });
    return NextResponse.json(wf);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت فرآیند" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const body = await req.json();
    const wf = await ds.updateWorkflow(id, body);
    if (!wf) return NextResponse.json({ error: "فرآیند یافت نشد" }, { status: 404 });
    return NextResponse.json(wf);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش فرآیند" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    await ds.deleteWorkflow(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف فرآیند" }, { status: 500 });
  }
}
