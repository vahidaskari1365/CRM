import { NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ds = await dataService();
    const products = await ds.listProducts();
    return NextResponse.json(products);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت محصولات" }, { status: 500 });
  }
}
