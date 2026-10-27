import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ds = await dataService();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const assigneeId = searchParams.get("assigneeId") ?? "";
    const tasks = await ds.listTasks(status || undefined, assigneeId || undefined);
    return NextResponse.json(tasks);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت وظایف" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ds = await dataService();
    const body = await req.json();
    if (!body.title) return NextResponse.json({ error: "عنوان الزامی است" }, { status: 400 });
    const task = await ds.createTask({
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? "todo",
      priority: body.priority ?? "medium",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assigneeId: body.assigneeId || null,
      customerId: body.customerId || null,
      dealId: body.dealId || null,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد وظیفه" }, { status: 500 });
  }
}
