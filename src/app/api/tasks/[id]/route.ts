import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const body = await req.json();
    const task = await ds.updateTask(id, {
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...body,
    });
    if (!task) return NextResponse.json({ error: "وظیفه یافت نشد" }, { status: 404 });
    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش وظیفه" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    await ds.deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف وظیفه" }, { status: 500 });
  }
}
