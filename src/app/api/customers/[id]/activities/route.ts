import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.type || !body.title) return NextResponse.json({ error: "نوع و عنوان الزامی است" }, { status: 400 });
    const activity = await db.activity.create({
      data: { type: body.type, title: body.title, content: body.content ?? null, customerId: id, userId: body.userId ?? null },
      include: { user: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ثبت فعالیت" }, { status: 500 });
  }
}
