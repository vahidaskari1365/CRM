import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workflows = await db.workflow.findMany({
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
    const withStats = await Promise.all(
      workflows.map(async (w) => {
        const total = await db.workflowRun.count({ where: { workflowId: w.id } });
        const success = await db.workflowRun.count({ where: { workflowId: w.id, status: "success" } });
        return {
          ...w,
          nodes: JSON.parse(w.nodes),
          edges: JSON.parse(w.edges),
          lastRun: w.runs[0] ? { id: w.runs[0].id, status: w.runs[0].status, startedAt: w.runs[0].startedAt } : null,
          runCount: total,
          successRate: total > 0 ? Math.round((success / total) * 100) : null,
        };
      })
    );
    return NextResponse.json(withStats);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت فرآیندها" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "نام فرآیند الزامی است" }, { status: 400 });
    const wf = await db.workflow.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        isActive: body.isActive ?? false,
        nodes: JSON.stringify(body.nodes ?? []),
        edges: JSON.stringify(body.edges ?? []),
      },
    });
    return NextResponse.json({ ...wf, nodes: JSON.parse(wf.nodes), edges: JSON.parse(wf.edges) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ایجاد فرآیند" }, { status: 500 });
  }
}
