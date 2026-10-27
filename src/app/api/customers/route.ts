import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ds = await dataService();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const status = searchParams.get("status") ?? "";
    const customers = await ds.listCustomers(q, status || undefined);
    return NextResponse.json(customers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت مشتریان" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ds = await dataService();
    const body = await req.json();
    if (!body.name || !body.company || !body.phone) {
      return NextResponse.json({ error: "نام، شرکت و تلفن الزامی است" }, { status: 400 });
    }
    const customer = await ds.createCustomer(body);
    return NextResponse.json(customer, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد مشتری" }, { status: 500 });
  }
}
