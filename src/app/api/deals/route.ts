import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ds = await dataService();
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage") ?? "";
    const deals = await ds.listDeals(stage || undefined);
    return NextResponse.json(deals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت فرصت‌ها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ds = await dataService();
    const body = await req.json();
    if (!body.title || !body.customerId) return NextResponse.json({ error: "عنوان و مشتری الزامی است" }, { status: 400 });
    const deal = await ds.createDeal({
      title: body.title,
      customerId: body.customerId,
      value: Number(body.value) || 0,
      stage: body.stage ?? "lead",
      probability: Number(body.probability) || 20,
      source: body.source ?? null,
      expectedClose: body.expectedClose ? new Date(body.expectedClose) : null,
      description: body.description ?? null,
    });
    return NextResponse.json(deal, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد فرصت" }, { status: 500 });
  }
}
