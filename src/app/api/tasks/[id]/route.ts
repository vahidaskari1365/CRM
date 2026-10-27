import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const k of ["title", "description", "status", "priority", "assigneeId", "customerId", "dealId"]) {
      if (k in body) data[k] = body[k] === "" ? null : body[k];
    }
    if ("dueDate" in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const task = await db.task.update({
      where: { id },
      data,
      include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } },
    });
    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش وظیفه" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف وظیفه" }, { status: 500 });
  }
}
