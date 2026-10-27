import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    if (q.trim().length < 2) return NextResponse.json({ customers: [], deals: [], tasks: [], quotes: [] });
    const ds = await dataService();
    const results = await ds.searchAll(q);
    return NextResponse.json(results);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در جستجو" }, { status: 500 });
  }
}
