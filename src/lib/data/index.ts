import { PrismaClient } from "@prisma/client";
import { memoryService } from "./memory";
import { prismaService } from "./prisma-impl";
import type { DataService } from "./types";

// ─── انتخاب خودکار لایه داده ───
// اگر دیتابیس (SQLite/Prisma) در دسترس باشد از Prisma استفاده می‌شود؛
// در غیر این صورت برنامه بدون هیچ خطایی در «حالت حافظه» اجرا می‌شود و
// همه بخش‌ها کاملاً قابل کارکرد و ثبت‌اند. تصمیم حالت در طول عمر فرآیند sticky است
// (ولی خود سرویس همیشه از ماژول جاری خوانده می‌شود تا با HMR هم سازگار بماند).

const g = globalThis as unknown as { __roudinMode?: "prisma" | "memory" };

async function probePrisma(): Promise<boolean> {
  // اگر خود PrismaClient قابل ساخت/بارگذاری نبود (مثلاً generate نشده) هم حالت حافظه
  try {
    const client = new PrismaClient();
    await client.$queryRaw`SELECT 1`;
    await client.$disconnect().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function resolveMode(): Promise<"prisma" | "memory"> {
  if (!g.__roudinMode) {
    const ok = await probePrisma();
    g.__roudinMode = ok ? "prisma" : "memory";
    if (!ok) console.warn("[رودین CRM] دیتابیس در دسترس نیست — اجرا در حالت حافظه (بدون دیتابیس)");
  }
  return g.__roudinMode;
}

export async function dataService(): Promise<DataService> {
  const mode = await resolveMode();
  return mode === "prisma" ? prismaService : memoryService;
}

export async function currentMode(): Promise<"prisma" | "memory"> {
  return resolveMode();
}

export * from "./types";
