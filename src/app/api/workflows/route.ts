import { NextRequest, NextResponse } from "next/server";
import { dataService } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ds = await dataService();
    const workflows = await ds.listWorkflows();
    return NextResponse.json(workflows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت فرآیندها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ds = await dataService();
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "نام فرآیند الزامی است" }, { status: 400 });
    const wf = await ds.createWorkflow({
      name: body.name,
      description: body.description ?? null,
      isActive: body.isActive ?? false,
      nodes: body.nodes ?? [],
      edges: body.edges ?? [],
    });
    return NextResponse.json(wf, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد فرآیند" }, { status: 500 });
  }
}
