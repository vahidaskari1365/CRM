import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await dataService();
    const body = await req.json();
    if (!body.type || !body.title) return NextResponse.json({ error: "نوع و عنوان الزامی است" }, { status: 400 });
    const activity = await ds.createCustomerActivity(id, { type: body.type, title: body.title, content: body.content ?? null, userId: body.userId ?? null });
    return NextResponse.json(activity, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ثبت فعالیت" }, { status: 500 });
  }
}
