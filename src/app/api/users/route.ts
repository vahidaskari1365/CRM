import { NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ds = await dataService();
    const users = await ds.listUsers();
    return NextResponse.json(users);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت کاربران" }, { status: 500 });
  }
}
