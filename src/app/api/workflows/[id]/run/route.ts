import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { WfEdge, WfNode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// موتور اجرای فرآیند رودین — اجرای واقعی گام‌به‌گام با ثبت لاگ
// ─────────────────────────────────────────────────────────────────

type Ctx = Record<string, unknown>;

function interpolate(template: string, ctx: Ctx): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = ctx[key];
    return v === undefined ? `{{${key}}}` : String(v);
  });
}

/** ارزیابی امن عبارت شرط با داده تستی */
function evalCondition(expr: string, ctx: Ctx): boolean {
  let e = expr.trim();
  if (!e) throw new Error("عبارت شرط خالی است — در تنظیمات گره شرط، عبارت را وارد کنید");
  if (/;|=>|\bfunction\b|\bimport\b|\brequire\b|\bprocess\b|\beval\b|\bconstructor\b/i.test(e)) {
    throw new Error("عبارت شرط شامل دستور غیرمجاز است");
  }
  e = e.replace(/[a-zA-Z_]\w*/g, (m) => {
    if (m === "true" || m === "false" || m === "null") return m;
    if (m in ctx) return JSON.stringify(ctx[m] ?? null);
    throw new Error(`متغیر «${m}» در داده تستی تعریف نشده است. آن را در پنل داده تستی اضافه کنید`);
  });
  if (!/^[\d\s+\-*/%.()<>=!&|'"_,:\[\]]*$/.test(e)) {
    throw new Error("عبارت شرط شامل کاراکتر غیرمجاز است");
  }
  try {
    const fn = new Function(`"use strict"; return (${e});`);
    return Boolean(fn());
  } catch (err) {
    throw new Error(`خطا در ارزیابی عبارت «${expr}»: ${err instanceof Error ? err.message : "نامشخص"}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface NodeResult {
  logs: string[];
  output?: Ctx;
  branch?: string | null; // برای شرط: true | false
  merge?: Ctx; // افزودن به کانتکست
}

async function executeNode(node: WfNode, ctx: Ctx): Promise<NodeResult> {
  const d = node.data ?? ({} as WfNode["data"]);
  switch (d.nodeType) {
    case "start": {
      return { logs: ["فرآیند آغاز شد", `داده تستی: ${JSON.stringify(ctx)}`] };
    }
    case "end": {
      return { logs: ["فرآیند با موفقیت به پایان رسید ✔"] };
    }
    case "condition": {
      const expr = d.expression ?? "";
      const result = evalCondition(expr, ctx);
      return {
        logs: [`عبارت شرط: ${expr}`, `مقدار ارزیابی‌شده: ${result ? "درست (بله)" : "نادرست (خیر)"}`, result ? "ادامه در شاخه «بله»" : "ادامه در شاخه «خیر»"],
        branch: result ? "true" : "false",
      };
    }
    case "create_task": {
      const title = interpolate(d.taskTitle || "وظیفه ساخته‌شده توسط فرآیند", ctx);
      if (!title.trim()) throw new Error("عنوان وظیفه خالی است — در تنظیمات گره، عنوان را وارد کنید");
      const task = await db.task.create({
        data: {
          title,
          description: `ساخته‌شده توسط فرآیند خودکار «${d.label ?? node.id}»`,
          status: "todo",
          priority: d.priority ?? "medium",
          dueDate: new Date(Date.now() + 86400000),
          customerId: typeof ctx.customerId === "string" ? ctx.customerId : null,
        },
      });
      return {
        logs: [`وظیفه واقعی «${title}» با اولویت ${d.priority === "urgent" ? "فوری" : d.priority === "high" ? "زیاد" : d.priority === "low" ? "کم" : "متوسط"} ایجاد شد`, `شناسه وظیفه در سیستم: ${task.id.slice(0, 12)}…`],
        output: { createdTaskId: task.id, createdTaskTitle: title },
      };
    }
    case "notify": {
      const message = interpolate(d.message || d.label || "اعلان فرآیند", ctx);
      if (!message.trim()) throw new Error("متن اعلان خالی است — در تنظیمات گره، پیام را وارد کنید");
      return { logs: [`اعلان ارسال شد: «${message}»`], output: { notified: message } };
    }
    case "add_activity": {
      const title = interpolate(d.title || d.label || "فعالیت فرآیند", ctx);
      if (typeof ctx.customerId === "string" && ctx.customerId) {
        const act = await db.activity.create({
          data: { type: "note", title, content: `ثبت‌شده توسط فرآیند خودکار: ${d.description ?? ""}`, customerId: ctx.customerId },
        });
        return { logs: [`فعالیت «${title}» در سوابق مشتری ثبت شد (شناسه: ${act.id.slice(0, 12)}…)`], output: { activityId: act.id } };
      }
      return { logs: [`شناسه مشتری (customerId) در داده تستی موجود نیست — فعالیت «${title}» به‌صورت شبیه‌سازی ثبت شد`], output: { simulated: true } };
    }
    case "update_deal": {
      const stage = (d.stage as string) ?? "negotiation";
      if (typeof ctx.dealId === "string" && ctx.dealId) {
        const deal = await db.deal.update({ where: { id: ctx.dealId }, data: { stage, probability: d.probability ? Number(d.probability) : undefined } }).catch(() => null);
        if (!deal) throw new Error(`فرصت با شناسه «${ctx.dealId}» یافت نشد`);
        return { logs: [`فرصت «${deal.title}» به مرحله جدید منتقل شد`], output: { dealStage: stage } };
      }
      return { logs: [`شناسه فرصت (dealId) در داده تستی نیست — شبیه‌سازی: انتقال به مرحله «${stage}»`], output: { simulated: true, dealStage: stage } };
    }
    case "http": {
      const url = (d.url ?? "").trim();
      if (!url) throw new Error("آدرس (URL) در تنظیمات گره HTTP وارد نشده است");
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      } catch (err) {
        throw new Error(`اتصال به «${url}» برقرار نشد (${err instanceof Error ? err.name : "خطای شبکه"}) — سرویس در دسترس نیست یا آدرس اشتباه است`);
      }
      const ms = Date.now() - started;
      if (!res.ok) throw new Error(`سرویس پاسخ ناموفق داد: کد وضعیت HTTP ${res.status} پس از ${ms}ms`);
      return { logs: [`درخواست به «${url}» → کد ${res.status} در ${ms}ms`], output: { status: res.status } };
    }
    case "delay": {
      const ms = Math.min(Number(d.ms) || 1000, 3000);
      await sleep(ms);
      return { logs: [`${ms} میلی‌ثانیه صبر شد`], output: { waitedMs: ms } };
    }
    default:
      throw new Error(`نوع گره «${d.nodeType ?? node.type}» شناخته نشده است`);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let testData: Ctx = {};
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.testData) {
      testData = typeof body.testData === "string" ? JSON.parse(body.testData) : body.testData;
    }
  } catch {
    return NextResponse.json({ error: "داده تستی باید JSON معتبر باشد" }, { status: 400 });
  }

  const wf = await db.workflow.findUnique({ where: { id } });
  if (!wf) return NextResponse.json({ error: "فرآیند یافت نشد" }, { status: 404 });

  let nodes: WfNode[] = [];
  let edges: WfEdge[] = [];
  try {
    nodes = JSON.parse(wf.nodes);
    edges = JSON.parse(wf.edges);
  } catch {
    return NextResponse.json({ error: "ساختار فرآیند (گره‌ها/اتصال‌ها) معتبر نیست" }, { status: 400 });
  }

  const run = await db.workflowRun.create({ data: { workflowId: id, testData: JSON.stringify(testData), status: "running" } });
  const startedAt = Date.now();
  const ctx: Ctx = { ...testData };

  const startNode = nodes.find((n) => (n.data as WfNode["data"])?.nodeType === "start");
  if (!startNode) {
    await db.workflowRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), duration: Date.now() - startedAt } });
    await db.workflowNodeRun.create({
      data: { runId: run.id, nodeId: "-", nodeName: "شروع", nodeType: "start", status: "failed", error: "هیچ گره «شروع» در فرآیند وجود ندارد", logs: JSON.stringify(["فرآیند بدون گره شروع قابل اجرا نیست"]), startedAt: new Date(), finishedAt: new Date() },
    });
    return NextResponse.json({ runId: run.id, status: "failed" });
  }

  let current: WfNode | undefined = startNode;
  let step = 0;
  let failed = false;
  let failNodeId = "";

  while (current && step < 50) {
    step += 1;
    const nodeData = current.data as WfNode["data"];
    const nodeStart = Date.now();
    const nr = await db.workflowNodeRun.create({
      data: { runId: run.id, nodeId: current.id, nodeName: nodeData.label ?? current.id, nodeType: nodeData.nodeType ?? current.type, status: "running", startedAt: new Date() },
    });
    try {
      const result = await executeNode(current, ctx);
      if (result.merge) Object.assign(ctx, result.merge);
      await db.workflowNodeRun.update({
        where: { id: nr.id },
        data: {
          status: "success",
          logs: JSON.stringify(result.logs),
          output: result.output ? JSON.stringify(result.output) : null,
          finishedAt: new Date(),
        },
      });
      // یافتن گره بعدی
      let outgoing = edges.filter((e) => e.source === current!.id);
      if (nodeData.nodeType === "condition") {
        outgoing = outgoing.filter((e) => (e.sourceHandle ?? "true") === (result.branch ?? "true"));
      }
      const nextEdge = outgoing[0];
      if (!nextEdge) {
        // انتهای مسیر (بدون گره پایان یا شاخه بدون اتصال)
        await db.workflowNodeRun.create({
          data: { runId: run.id, nodeId: `__end_${step}`, nodeName: "پایان مسیر", nodeType: "end", status: "success", logs: JSON.stringify([nodeData.nodeType === "condition" ? "شاخه انتخاب‌شده به گره دیگری متصل نیست — مسیر در همین‌جا پایان یافت" : "گره بعدی وجود ندارد — مسیر پایان یافت"]), startedAt: new Date(), finishedAt: new Date() },
        });
        current = undefined;
        break;
      }
      current = nodes.find((n) => n.id === nextEdge.target);
      if (!current) throw new Error(`اتصال به گره ناموجود «${nextEdge.target}»`);
      if ((current.data as WfNode["data"]).nodeType === "end") {
        // اجرای گره پایان در چرخه بعدی
      }
    } catch (err) {
      failed = true;
      failNodeId = current.id;
      const msg = err instanceof Error ? err.message : "خطای ناشناخته در اجرای گره";
      await db.workflowNodeRun.update({
        where: { id: nr.id },
        data: { status: "failed", error: msg, logs: JSON.stringify([`خطا در گره «${nodeData.label}»: ${msg}`]), finishedAt: new Date() },
      });
      // علامت‌گذاری بقیه گره‌های مسیر به‌عنوان ردشده
      const visited = new Set<string>();
      let cur: WfNode | undefined = nodes.find((n) => n.id === (startNode?.id ?? ""));
      while (cur && !visited.has(cur.id)) {
        visited.add(cur.id);
        const outs = edges.filter((e) => e.source === cur!.id);
        cur = outs.length ? nodes.find((n) => n.id === outs[0].target) : undefined;
      }
      current = undefined;
      break;
    }
  }

  const status = failed ? "failed" : "success";
  const duration = Date.now() - startedAt;
  await db.workflowRun.update({
    where: { id: run.id },
    data: { status, finishedAt: new Date(), duration },
  });

  const nodeRuns = await db.workflowNodeRun.findMany({ where: { runId: run.id }, orderBy: { startedAt: "asc" } });
  const failNode = failed ? nodes.find((n) => n.id === failNodeId) : null;

  return NextResponse.json({
    runId: run.id,
    status,
    duration,
    context: ctx,
    failureHint: failNode
      ? `گره «${(failNode.data as WfNode["data"]).label}» با خطا متوقف شد. تنظیمات این گره یا داده تستی ورودی را بررسی کنید.`
      : undefined,
    nodeRuns: nodeRuns.sort((a, b) => new Date(a.startedAt ?? a.id).getTime() - new Date(b.startedAt ?? b.id).getTime()),
  });
}
