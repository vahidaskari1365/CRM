import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const wf = await db.workflow.findUnique({
      where: { id },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 10, include: { nodeRuns: true } } },
    });
    if (!wf) return NextResponse.json({ error: "فرآیند یافت نشد" }, { status: 404 });
    return NextResponse.json({
      ...wf,
      nodes: JSON.parse(wf.nodes),
      edges: JSON.parse(wf.edges),
      runs: wf.runs.map((r) => ({ ...r, nodeRuns: r.nodeRuns.sort((a, b) => new Date(a.startedAt ?? a.id).getTime() - new Date(b.startedAt ?? b.id).getTime()) })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در دریافت فرآیند" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if ("name" in body) data.name = body.name;
    if ("description" in body) data.description = body.description;
    if ("isActive" in body) data.isActive = body.isActive;
    if ("nodes" in body) data.nodes = JSON.stringify(body.nodes);
    if ("edges" in body) data.edges = JSON.stringify(body.edges);
    const wf = await db.workflow.update({ where: { id }, data });
    return NextResponse.json({ ...wf, nodes: JSON.parse(wf.nodes), edges: JSON.parse(wf.edges) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در ویرایش فرآیند" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.workflow.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "خطا در حذف فرآیند" }, { status: 500 });
  }
}
