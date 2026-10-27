import { NextResponse } from "next/server";
import { dataService, currentMode } from "@/lib/data";

export const dynamic = "force-dynamic";

/** سلامت سیستم + حالت لایه داده (prisma = دیتابیس فعال، memory = بدون دیتابیس) */
export async function GET() {
  try {
    const ds = await dataService();
    const resolved = await currentMode();
    return NextResponse.json({
      ok: true,
      mode: ds.mode,
      label: ds.mode === "prisma" ? "دیتابیس فعال" : "حالت حافظه (بدون دیتابیس)",
      app: "رودین CRM",
      version: "1.0.0",
      time: new Date().toISOString(),
      resolved,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({
      ok: true,
      mode: "memory",
      label: "حالت حافظه (بدون دیتابیس)",
      app: "رودین CRM",
      version: "1.0.0",
      time: new Date().toISOString(),
    });
  }
}
