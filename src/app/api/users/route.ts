import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json(users);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت کاربران" }, { status: 500 });
  }
}
