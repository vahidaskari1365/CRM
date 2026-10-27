import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const assigneeId = searchParams.get("assigneeId") ?? "";
    const tasks = await db.task.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(assigneeId ? { assigneeId } : {}),
      },
      include: {
        assignee: true,
        customer: { select: { id: true, company: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    return NextResponse.json(tasks);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت وظایف" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.title) return NextResponse.json({ error: "عنوان الزامی است" }, { status: 400 });
    const task = await db.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? "todo",
        priority: body.priority ?? "medium",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assigneeId: body.assigneeId || null,
        customerId: body.customerId || null,
        dealId: body.dealId || null,
      },
      include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد وظیفه" }, { status: 500 });
  }
}
