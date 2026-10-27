"use client";

import "@xyflow/react/dist/style.css";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ReactFlow, Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type Node, type NodeProps, type NodeTypes, type OnEdgesChange, type OnNodesChange, type XYPosition } from "@xyflow/react";
import { toast } from "sonner";
import { AlertCircle, Bell, Check, CheckCircle2, ChevronDown, FileJson, Flag, GitBranch, Globe, Grab, History, Info, LayoutTemplate, Loader2, PenLine, Pencil, Play, Plus, Settings2, Timer, Trash2, TrendingUp, Upload, UserCheck, Workflow as WorkflowIcon, XCircle, Zap, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEAL_STAGES, TASK_PRIORITIES, faDateTime, faDuration, faNum, faPercent, stageLabel } from "@/lib/format";
import { WF_NODE_TYPES } from "@/lib/types";
import { buildDefaultTestData, ensureConditionVars } from "@/lib/wf-defaults";
import type { CustomerDto, RunDto, WorkflowDto, WfEdge, WfNode } from "@/lib/types";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// ─────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────

type WfNodeStatus = "success" | "failed" | "running";
type CrmNodeData = WfNode["data"] & { status?: WfNodeStatus };
type CrmFlowNode = Node<CrmNodeData, "crm">;
type FlowEdge = Edge;
/** سرور علاوه بر RunDto فیلدهای failureHint و context را هم برمی‌گرداند */
type RunResult = RunDto & { failureHint?: string; context?: Record<string, unknown> };
type WorkflowDetail = WorkflowDto & { runs?: RunDto[] };

/** نقشه وضعیت زنده گره‌ها در حین پخش اجرا (بین گزارش تست و بوم مشترک است) */
const NodeStatusContext = createContext<Record<string, WfNodeStatus>>({});
NodeStatusContext.displayName = "WfNodeStatus";

const CONDITION_VARS = ["dealValue", "customerName", "customerId", "dealId"] as const;

const ICONS: Record<string, LucideIcon> = { Zap, PenLine, GitBranch, UserCheck, Bell, Timer, Flag, History, TrendingUp, Globe };
const nodeMeta = (nodeType: string) => WF_NODE_TYPES.find((t) => t.type === nodeType) ?? WF_NODE_TYPES[0];
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const runStatusColor = (s: string): string =>
  s === "success" ? "#10b981" : s === "failed" ? "#ef4444" : s === "running" ? "var(--primary)" : "#6b7280";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "خطای نامشخص در ارتباط با سرور";
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `خطای سرور (${res.status})`);
  return data;
}

function toFlowNodes(nodes: WfNode[]): CrmFlowNode[] {
  return nodes.map((n) => ({ id: n.id, type: "crm" as const, position: { x: n.position.x, y: n.position.y }, data: { ...n.data } }));
}

function toWfNodes(nodes: CrmFlowNode[]): WfNode[] {
  return nodes.map((n) => ({ id: n.id, type: str(n.data.nodeType) || "start", position: { x: n.position.x, y: n.position.y }, data: { ...n.data, status: undefined } }));
}

function toWfEdges(edges: FlowEdge[]): WfEdge[] {
  return edges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null,
    label: typeof e.label === "string" ? e.label : undefined, animated: false,
  }));
}

/** ظاهر یال‌ها مطابق طرح: خط خاکستری با پیکان؛ بله سبز، خیر خاکستری */
function edgeVisual(label?: string): Partial<Edge> {
  const marker = (color: string) => ({ type: MarkerType.ArrowClosed, width: 15, height: 15, color });
  const base = { animated: false } as const;
  if (label === "بله") {
    return {
      ...base,
      labelStyle: { fill: "#34d399", fontSize: 11, fontWeight: 700 } as CSSProperties,
      labelBgStyle: { fill: "color-mix(in oklab, #10b981 18%, transparent)" } as CSSProperties,
      labelBgPadding: [7, 4] as [number, number],
      labelBgBorderRadius: 8,
      markerEnd: marker("#10b981"),
    };
  }
  if (label === "خیر") {
    return {
      ...base,
      labelStyle: { fill: "#9ca3af", fontSize: 11, fontWeight: 700 } as CSSProperties,
      labelBgStyle: { fill: "color-mix(in oklab, #6b7280 20%, transparent)" } as CSSProperties,
      labelBgPadding: [7, 4] as [number, number],
      labelBgBorderRadius: 8,
      markerEnd: marker("#71717a"),
    };
  }
  return { ...base, markerEnd: marker("#52525b") };
}

function toFlowEdges(edges: WfEdge[]): FlowEdge[] {
  return edges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined,
    label: e.label ?? undefined, ...edgeVisual(e.label ?? undefined),
  }));
}

function parseJsonArr(raw: string | null | undefined): string[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** نوع MIME هنگام درگ گره از پالت به بوم */
const DRAG_MIME = "application/rudin-node";
/** ظاهر یال سبز «مسیر طی‌شده» در حین و پس از پخش اجرا — مثل حرکت مسیر در n8n */
const GREEN_EDGE = {
  style: { stroke: "#10b981", strokeWidth: 2 } as CSSProperties,
  marker: () => ({ type: MarkerType.ArrowClosed as const, width: 15, height: 15, color: "#10b981" }),
};

// ─── پالت افزودن گره — دقیقاً مطابق طرح ───
const PALETTE_GROUPS: { title?: string; types: string[] }[] = [
  { types: ["start"] },
  { title: "عملیات", types: ["create_task", "condition", "approval"] },
  { title: "ارتباطات", types: ["notify"] },
  { title: "انتظار / خروج", types: ["delay", "end"] },
];

/** داده تستی پیش‌فرض: متغیرهای شرط‌ها را با مقادیر گذرنده پر می‌کند (پیاده‌سازی مشترک در lib/wf-defaults) */

/** قالب نمونه «فروش خودرو (نمونه)» — همان فرایند طرح */
function carTemplate(): { nodes: WfNode[]; edges: WfEdge[] } {
  const nodes: WfNode[] = [
    { id: "car_start", type: "crm", position: { x: 40, y: 210 }, data: { label: "درخواست مشتری", nodeType: "start", description: "دریافت درخواست خرید خودرو" } },
    { id: "car_stock", type: "crm", position: { x: 330, y: 210 }, data: { label: "بررسی موجودی نمایشگاه", nodeType: "create_task", description: "بررسی موجودی خودروی درخواستی", taskTitle: "بررسی موجودی خودرو برای {{customerName}}", priority: "medium" } },
    { id: "car_cond", type: "crm", position: { x: 640, y: 195 }, data: { label: "خودرو آماده فروش هست؟", nodeType: "condition", description: "بررسی آماده بودن خودروی مورد نظر", expression: "carReady == true" } },
    { id: "car_finance", type: "crm", position: { x: 950, y: 60 }, data: { label: "بررسی مالی مشتری", nodeType: "create_task", description: "بررسی اعتبار و شرایط پرداخت", taskTitle: "بررسی مالی {{customerName}}", priority: "high" } },
    { id: "car_deliver", type: "crm", position: { x: 1250, y: 60 }, data: { label: "هماهنگی تحویل خودرو", nodeType: "notify", description: "زمان‌بندی آزمایش و تحویل", message: "قرار آزمایش و تحویل خودرو با {{customerName}} هماهنگ شد" } },
    { id: "car_info", type: "crm", position: { x: 950, y: 350 }, data: { label: "به مشتری اطلاع بده — ماشین به زودی می‌رسد", nodeType: "notify", description: "اطلاع‌رسانی زمان آماده شدن", message: "{{customerName}} عزیز، خودروی درخواستی به زودی به نمایشگاه می‌رسد" } },
    { id: "car_end", type: "crm", position: { x: 1550, y: 205 }, data: { label: "پایان", nodeType: "end", description: "" } },
  ];
  const edges: WfEdge[] = [
    { id: "ce1", source: "car_start", target: "car_stock" },
    { id: "ce2", source: "car_stock", target: "car_cond" },
    { id: "ce3", source: "car_cond", target: "car_finance", sourceHandle: "true", label: "بله" },
    { id: "ce4", source: "car_cond", target: "car_info", sourceHandle: "false", label: "خیر" },
    { id: "ce5", source: "car_finance", target: "car_deliver" },
    { id: "ce6", source: "car_deliver", target: "car_end" },
    { id: "ce7", source: "car_info", target: "car_end" },
  ];
  return { nodes, edges };
}

function templateWorkflow(): WorkflowDto {
  const t = carTemplate();
  return {
    id: "",
    name: "فروش خودرو (نمونه)",
    description: "قالب آماده فروش خودرو — پس از ویرایش ذخیره کنید تا در فهرست فرایندها ثبت شود.",
    isActive: false,
    nodes: t.nodes,
    edges: t.edges,
    createdAt: new Date().toISOString(),
    lastRun: null,
    runCount: 0,
  };
}

/** ردیف برچسب + محتوا (کاهش تکرار در فرم‌ها) */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Custom React Flow node «crm» — کارت گرد با آیکن‌رنگ و نقطه خروجی کهربایی
// ─────────────────────────────────────────────────────────────────

function CrmNodeView({ id, data, selected }: NodeProps<CrmFlowNode>) {
  const statuses = useContext(NodeStatusContext);
  const hasRun = Object.keys(statuses).length > 0;
  const status = statuses[id] ?? data.status;
  const meta = nodeMeta(str(data.nodeType));
  const Icon = ICONS[meta.icon] ?? WorkflowIcon;
  const isCondition = str(data.nodeType) === "condition";
  return (
    <div
      dir="rtl"
      className={cn(
        "wf-node relative rounded-2xl border bg-card shadow-xl shadow-black/25",
        selected && "border-primary/70 ring-2 ring-primary/30",
        status === "success" && "wf-node-success",
        status === "failed" && "wf-node-failed",
        status === "running" && "wf-node-running",
        hasRun && !status && "opacity-40 saturate-50"
      )}
      style={{ width: 224, ...(status === "success" ? { background: "color-mix(in oklab, #10b981 9%, var(--card))" } : null) }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 9, height: 9, background: "var(--muted-foreground)", borderColor: "var(--background)" }} />
      <div className="flex items-start gap-2.5 p-3">
        <motion.span
          key={status ?? "idle"}
          initial={status === "success" ? { scale: 0.35, rotate: -18 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={status === "success" ? { backgroundColor: "#10b981", color: "#ffffff" } : { backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {status === "success" ? <Check className="size-4" /> : <Icon className="size-4" />}
        </motion.span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block text-[13px] font-bold leading-5 text-foreground">{str(data.label) || meta.label}</span>
          {str(data.description) ? <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{data.description}</span> : null}
        </span>
      </div>
      {status === "running" && (
        <span className="absolute -left-2.5 -top-2.5 flex size-6 items-center justify-center rounded-full border bg-background shadow-md">
          <Loader2 className="size-3.5 animate-spin text-primary" />
        </span>
      )}
      {status === "failed" && (
        <span className="absolute -left-2.5 -top-2.5 flex size-6 items-center justify-center rounded-full border bg-background shadow-md">
          <XCircle className="size-3.5 text-red-400" />
        </span>
      )}
      {isCondition ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: "26%", width: 11, height: 11, background: "#f59e0b", borderColor: "#78350f" }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: "74%", width: 11, height: 11, background: "#f59e0b", borderColor: "#78350f" }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} style={{ width: 11, height: 11, background: "#f59e0b", borderColor: "#78350f" }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Config fields (type-specific)
// ─────────────────────────────────────────────────────────────────

function ConfigFields({ nodeType, draft, patch }: { nodeType: string; draft: CrmNodeData; patch: (p: Partial<CrmNodeData>) => void }) {
  switch (nodeType) {
    case "condition":
      return (
        <div className="space-y-2">
          <Field label="عبارت شرط">
            <Input dir="ltr" className="font-mono text-xs" placeholder="carReady == true" value={str(draft.expression)} onChange={(e) => patch({ expression: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-1">
            {CONDITION_VARS.map((v) => (
              <button
                key={v} type="button" dir="ltr"
                onClick={() => { const cur = str(draft.expression).trim(); patch({ expression: cur ? `${cur} ${v}` : v }); }}
                className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">متغیرها با داده تستی ارزیابی می‌شوند — برای افزودن به عبارت روی آن‌ها کلیک کنید.</p>
        </div>
      );
    case "create_task":
      return (
        <div className="space-y-2">
          <Field label="عنوان وظیفه">
            <Input value={str(draft.taskTitle)} placeholder="بررسی موجودی برای {{customerName}}" onChange={(e) => patch({ taskTitle: e.target.value })} />
          </Field>
          <p className="text-[10px] text-muted-foreground">از {"{{customerName}}"} برای درج خودکار نام مشتری استفاده کنید.</p>
          <Field label="اولویت">
            <Select value={str(draft.priority) || "medium"} onValueChange={(v) => patch({ priority: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case "approval":
      return (
        <div className="space-y-2">
          <Field label="عنوان درخواست تأیید">
            <Input value={str(draft.taskTitle)} placeholder="تأیید مدیر: {{customerName}}" onChange={(e) => patch({ taskTitle: e.target.value })} />
          </Field>
          <p className="text-[10px] leading-4 text-muted-foreground">یک وظیفهٔ واقعی با اولویت «زیاد» برای مدیر ایجاد می‌شود و فرایند ادامه پیدا می‌کند.</p>
        </div>
      );
    case "notify":
      return (
        <Field label="متن پیام یا ایمیل">
          <Textarea rows={3} className="text-xs" value={str(draft.message)} placeholder="متن اطلاع‌رسانی…" onChange={(e) => patch({ message: e.target.value })} />
        </Field>
      );
    case "add_activity":
      return (
        <Field label="عنوان فعالیت">
          <Input value={str(draft.title)} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
      );
    case "update_deal":
      return (
        <div className="space-y-2">
          <Field label="مرحله جدید فرصت">
            <Select value={str(draft.stage) || "negotiation"} onValueChange={(v) => patch({ stage: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="احتمال موفقیت (٪)">
            <Input type="number" min={0} max={100} dir="ltr" className="font-mono text-xs" value={draft.probability === undefined || draft.probability === null ? "" : str(draft.probability)} onChange={(e) => patch({ probability: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Field>
        </div>
      );
    case "http":
      return (
        <Field label="آدرس (URL)">
          <Input dir="ltr" className="font-mono text-xs" placeholder="https://api.example.com/health" value={str(draft.url)} onChange={(e) => patch({ url: e.target.value })} />
        </Field>
      );
    case "delay":
      return (
        <div className="space-y-2">
          <Field label="مدت مکث (میلی‌ثانیه)">
            <Input type="number" min={0} max={3000} dir="ltr" className="font-mono text-xs" value={draft.ms === undefined || draft.ms === null ? "" : str(draft.ms)} onChange={(e) => patch({ ms: e.target.value === "" ? undefined : Math.min(Number(e.target.value), 3000) })} />
          </Field>
          <p className="text-[10px] text-muted-foreground">حداکثر ۳۰۰۰ میلی‌ثانیه</p>
        </div>
      );
    default:
      return null; // start / end فقط عنوان
  }
}

// ─────────────────────────────────────────────────────────────────
// Palette (افزودن گره) — سمت چپ بوم
// ─────────────────────────────────────────────────────────────────

function Palette({ onAdd }: { onAdd: (t: (typeof WF_NODE_TYPES)[number]) => void }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card/50 p-3">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
        <Plus className="size-3.5 text-amber-400" /> افزودن گره
        <span className="ms-auto flex items-center gap-1 text-[9px] font-normal text-muted-foreground"><Grab className="size-3" /> بکشید</span>
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-x-visible xl:overflow-y-auto xl:pb-0">
        {PALETTE_GROUPS.map((g, gi) => (
          <div key={gi} className="xl:w-full">
            {g.title && <p className="mb-1.5 mt-1 hidden text-[10px] font-bold text-muted-foreground xl:block">{g.title}</p>}
            <div className="flex gap-2 xl:flex-col xl:gap-1.5">
              {g.types.map((t) => {
                const meta = nodeMeta(t);
                const Icon = ICONS[meta.icon] ?? WorkflowIcon;
                return (
                  <button
                    key={t} type="button" draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, t);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onAdd(meta)}
                    title="بکشید و روی بوم رها کنید — یا کلیک کنید"
                    className="flex min-w-[150px] shrink-0 cursor-grab items-center gap-2 rounded-xl border bg-background/60 px-2.5 py-2 text-right transition hover:border-amber-500/50 hover:bg-accent/40 active:cursor-grabbing xl:w-full xl:min-w-0"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-[11px] font-bold leading-4 xl:whitespace-normal">{meta.label}</span>
                      <span className="hidden truncate text-[9px] text-muted-foreground xl:block">{meta.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto hidden items-start gap-1.5 pt-3 text-[10px] leading-4 text-muted-foreground xl:flex">
        <Info className="mt-0.5 size-3 shrink-0" />
        <span>گره‌ها را بکشید و روی بوم رها کنید یا روی آن‌ها کلیک کنید. برای اتصال، روی دایره خروجی گره بزنید و گره مقصد را انتخاب کنید.</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Config panel — سمت راست بوم
// ─────────────────────────────────────────────────────────────────

function ConfigPanel({ node, draft, patch, apply, remove }: {
  node: CrmFlowNode | null; draft: CrmNodeData | null;
  patch: (p: Partial<CrmNodeData>) => void; apply: () => void; remove: () => void;
}) {
  return (
    <div className="h-full rounded-2xl border bg-card/50 p-3">
      <AnimatePresence mode="wait">
        {node && draft ? (
          <motion.div key={`cfg-${node.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.2 }}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold">تنظیمات گره</h3>
              <Badge variant="secondary" className="text-[9px]">{nodeMeta(str(draft.nodeType)).label}</Badge>
            </div>
            <div className="mt-3 space-y-2.5">
              <Field label="عنوان"><Input className="text-xs" value={str(draft.label)} onChange={(e) => patch({ label: e.target.value })} /></Field>
              <Field label="توضیح"><Textarea rows={2} className="text-xs" value={str(draft.description)} onChange={(e) => patch({ description: e.target.value })} /></Field>
              <ConfigFields nodeType={str(draft.nodeType)} draft={draft} patch={patch} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="h-8 flex-1" onClick={apply}>اعمال</Button>
              <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={remove}><Trash2 className="size-3.5" /> حذف</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="cfg-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col items-center justify-center gap-3 px-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border bg-background">
              <Settings2 className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">گره‌ای انتخاب نشده است</p>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">روی یک گره در بوم کلیک کنید تا تنظیمات آن اینجا نمایش داده شود.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Legend — راهنمای وضعیت زیر بوم
// ─────────────────────────────────────────────────────────────────

function StatusDot({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", pulse && "animate-pulse")} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-1 text-[10px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <StatusDot color="#2dd4bf" label="موفق" />
        <StatusDot color="#ef4444" label="خطا — نیاز به اصلاح" />
        <StatusDot color="#f59e0b" label="در حال اجرا" pulse />
        <StatusDot color="#71717a" label="در انتظار اجرا" />
      </div>
      <span className="hidden md:block">هر گره در تست، واقعاً روی داده‌های زندهٔ سازمان اجرا می‌شود و نتیجه در گزارش پایین ثبت می‌گردد.</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ReportPanel — گزارش اجرای تست (پنل پایین)
// ─────────────────────────────────────────────────────────────────

function ReportPanel({ result, playIndex, running, open, onToggle, testData, onTestDataChange, onInsertDefault, onFixNode, onOpenHistory, canOpenHistory }: {
  result: RunResult | null; playIndex: number; running: boolean; open: boolean; onToggle: () => void;
  testData: string; onTestDataChange: (v: string) => void; onInsertDefault: () => void;
  onFixNode: (nodeId: string) => void; onOpenHistory: () => void; canOpenHistory: boolean;
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const playbackDone = !!result && playIndex >= result.nodeRuns.length;
  const failedNode = result?.nodeRuns.find((nr) => nr.status === "failed") ?? null;

  const artifacts = useMemo(() => {
    if (!result) return [] as string[];
    const out: string[] = [];
    for (const nr of result.nodeRuns) {
      try {
        const o = nr.output ? (JSON.parse(nr.output) as Record<string, unknown>) : null;
        if (!o) continue;
        if (o.createdTaskTitle) out.push(`وظیفه ساخته شد: ${String(o.createdTaskTitle)}`);
        else if (o.approvalRequired) out.push(`تأیید مدیر ثبت شد: ${String(o.approvalRequired)}`);
        else if (o.activityId) out.push("فعالیت در سوابق مشتری ثبت شد");
        else if (o.notified) out.push(`اعلان: ${String(o.notified)}`);
        else if (o.dealStage) out.push(`مرحله فرصت ← ${stageLabel(String(o.dealStage))}`);
      } catch {
        /* خروجی JSON معتبر نیست — نادیده */
      }
    }
    return out;
  }, [result]);

  return (
    <div className="rounded-2xl border bg-card/50 shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 text-right">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400"><Zap className="size-4" /></span>
          <span className="text-sm font-bold">گزارش اجرای تست</span>
          {running && (
            <Badge variant="secondary" className="gap-1 text-[10px]"><Loader2 className="size-3 animate-spin" /> در حال اجرا…</Badge>
          )}
          {result && !running && playbackDone && (
            <Badge variant="secondary" className={cn("text-[10px]", result.status === "success" ? "text-emerald-400" : "text-red-400")}>
              {result.status === "success" ? "اجرای موفق" : "اجرای ناموفق"} · {faDuration(result.duration)}
            </Badge>
          )}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" disabled={!canOpenHistory} onClick={onOpenHistory}>
          <History className="size-3.5" /> تاریخچه
        </Button>
      </div>
      {open && (
        <div className="border-t px-4 py-4">
          {!result && !running ? (
            <div className="py-6 text-center">
              <p className="text-sm leading-7 text-muted-foreground">دکمه «تست فرایند» را بزنید تا اجرای گام‌به‌گام هر گره (موفق/خطا و علائم آن) به‌صورت زنده اینجا ثبت شود.</p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* مسیر اجرا */}
              <div className="min-w-0">
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><GitBranch className="size-3.5" /> مسیر اجرا (گام‌به‌گام)</h4>
                {running && !result ? (
                  <div className="flex items-center gap-2 rounded-xl border bg-background/50 px-3 py-4 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-amber-400" /> در حال اجرای واقعی فرایند روی داده‌ها…
                  </div>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pe-1">
                    {result?.nodeRuns.map((nr, i) => {
                      if (i > playIndex) return null; // نمایش تدریجی در حین پخش
                      const st = i < playIndex ? nr.status : "running";
                      const isFailed = st === "failed";
                      const dur = nr.startedAt && nr.finishedAt ? faDuration(new Date(nr.finishedAt).getTime() - new Date(nr.startedAt).getTime()) : null;
                      const logs = parseJsonArr(nr.logs);
                      return (
                        <motion.div key={nr.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                          <button
                            type="button" onClick={() => setExpandedStep((p) => (p === nr.id ? null : nr.id))}
                            className={cn("flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-right transition", isFailed ? "border-red-500/40 bg-red-500/5" : "border-border bg-background/50 hover:border-primary/40")}
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
                              {st === "running" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                              {st === "success" && <CheckCircle2 className="size-3.5 text-emerald-400" />}
                              {isFailed && <XCircle className="size-3.5 text-red-400" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold">{nr.nodeName}</span>
                              {dur && <span className="block text-[10px] text-muted-foreground">{dur}</span>}
                            </span>
                            {isFailed && <Badge variant="destructive" className="shrink-0 text-[9px]">خطا</Badge>}
                            <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expandedStep === nr.id && "rotate-180")} />
                          </button>
                          {expandedStep === nr.id && (
                            <div className="mt-1 space-y-2 rounded-xl border bg-background/60 p-2.5">
                              {logs.length > 0 && (
                                <ul className="space-y-1">
                                  {logs.map((l, li) => <li key={li} className="text-[11px] leading-5 text-muted-foreground">• {l}</li>)}
                                </ul>
                              )}
                              {isFailed && (
                                <div className="space-y-2">
                                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-[11px] leading-5 text-red-400">{nr.error}</div>
                                  {result?.failureHint && <p className="text-[11px] leading-5 text-muted-foreground">{result.failureHint}</p>}
                                  <Button type="button" size="sm" variant="outline" className="h-7 w-full gap-1.5 text-[11px]" onClick={() => onFixNode(nr.nodeId)}>
                                    <Pencil className="size-3" /> اصلاح این گره در طراح
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* جمع‌بندی + داده تستی */}
              <div className="min-w-0 space-y-3">
                {result && playbackDone && (
                  result.status === "success" ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                        <CheckCircle2 className="size-4 shrink-0" /> فرایند با موفقیت اجرا شد در {faDuration(result.duration)}
                      </div>
                      {artifacts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {artifacts.map((a, i) => (
                            <span key={i} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">{a}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                        <AlertCircle className="size-4 shrink-0" /> فرایند در گره «{failedNode?.nodeName ?? "نامشخص"}» متوقف شد
                      </div>
                      {result.failureHint && <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{result.failureHint}</p>}
                      {failedNode && (
                        <Button type="button" size="sm" variant="outline" className="mt-2.5 h-7 gap-1.5 text-[11px]" onClick={() => onFixNode(failedNode.nodeId)}>
                          <Pencil className="size-3" /> اصلاح این گره در طراح
                        </Button>
                      )}
                    </div>
                  )
                )}
                <details className="rounded-xl border bg-background/40 px-3 py-2.5">
                  <summary className="cursor-pointer select-none text-xs font-bold">داده تستی (JSON)</summary>
                  <Textarea dir="ltr" spellCheck={false} className="mt-2 h-24 resize-none font-mono text-[11px]" value={testData} onChange={(e) => onTestDataChange(e.target.value)} />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] leading-4 text-muted-foreground">شرط‌ها با این داده ارزیابی می‌شوند.</p>
                    <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={onInsertDefault}>
                      <FileJson className="size-3" /> درج پیش‌فرض
                    </Button>
                  </div>
                </details>
                {result && playbackDone && result.context && (
                  <details className="rounded-xl border bg-background/40 px-3 py-2.5">
                    <summary className="cursor-pointer select-none text-xs font-bold text-muted-foreground">کانتکست نهایی اجرا</summary>
                    <pre dir="ltr" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-muted-foreground">{JSON.stringify(result.context, null, 2)}</pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FlowCanvas — بوم با پشتیبانی درگ‌انددراپ گره از پالت (مثل n8n)
// ─────────────────────────────────────────────────────────────────

function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick, onPaneClick, nodeTypes, onDropType }: {
  nodes: CrmFlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<CrmFlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: (c: Connection) => void;
  onNodeClick: (node: CrmFlowNode) => void;
  onPaneClick: () => void;
  nodeTypes: NodeTypes;
  onDropType: (type: string, position: XYPosition) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const onDragEnter = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes(DRAG_MIME)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }, []);

  const onDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes(DRAG_MIME)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      const t = e.dataTransfer.getData(DRAG_MIME);
      if (!t) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      // مرکز گره (عرض ۲۲۴px) زیر نشانگر ماوس قرار بگیرد
      onDropType(t, { x: p.x - 112, y: p.y - 26 });
    },
    [screenToFlowPosition, onDropType]
  );

  return (
    <div
      dir="ltr"
      className={cn(CANVAS_H, "relative rounded-2xl", dragOver && "outline-2 outline-dashed outline-amber-500/80")}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node)}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 24, y: 10, zoom: 0.78 }}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.2}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.7} color="color-mix(in oklab, var(--muted-foreground) 32%, transparent)" />
      </ReactFlow>
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-amber-500/5"
          >
            <span className="flex items-center gap-2 rounded-full border border-amber-500/60 bg-background/95 px-4 py-2 text-xs font-bold text-amber-500 shadow-lg">
              <Plus className="size-4" /> رها کنید تا گره اینجا اضافه شود
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Designer — طراح گرافیکی فرایند
// ─────────────────────────────────────────────────────────────────

const CANVAS_H = "h-[56vh] min-h-[440px]";

function Designer({ workflow, workflows, firstCustomerId, autoRun, onStatuses, onLoad, onTemplate, onNew }: {
  workflow: WorkflowDto | null; workflows: WorkflowDto[]; firstCustomerId?: string; autoRun: boolean;
  onStatuses: (m: Record<string, WfNodeStatus>) => void;
  onLoad: (id: string) => void; onTemplate: () => void; onNew: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(workflow?.name ?? "");
  const [savedId, setSavedId] = useState<string | null>(workflow?.id || null);
  const [isActive, setIsActive] = useState<boolean>(workflow?.isActive ?? false);

  const initialNodes = toFlowNodes(workflow?.nodes ?? [{ id: "start_1", type: "crm", position: { x: 120, y: 200 }, data: { label: "شروع", nodeType: "start", description: "نقطه آغاز فرایند" } }]);
  const initialEdges = toFlowEdges(workflow?.edges ?? []);
  const [nodes, setNodes, onNodesChange] = useNodesState<CrmFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CrmNodeData | null>(null);
  const [testData, setTestData] = useState<string>(() => buildDefaultTestData(initialNodes, firstCustomerId));
  const [result, setResult] = useState<RunResult | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(true);
  const [histOpen, setHistOpen] = useState(false);

  const nodeTypes = useMemo<NodeTypes>(() => ({ crm: CrmNodeView }), []);

  // پخش انیمیشنی: هر ۵۰۰ms یک گره در مسیر جلو می‌رود
  useEffect(() => {
    if (!result) return;
    const timer = setInterval(() => {
      setPlayIndex((p) => {
        if (p >= result.nodeRuns.length) {
          clearInterval(timer);
          return p;
        }
        return p + 1;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [result]);

  // نگاشت playIndex → وضعیت هر گره (روی بوم از طریق Context اعمال می‌شود)
  useEffect(() => {
    if (!result) return;
    const map: Record<string, WfNodeStatus> = {};
    result.nodeRuns.forEach((nr, i) => {
      if (i < playIndex) map[nr.nodeId] = nr.status === "failed" ? "failed" : "success";
      else if (i === playIndex) map[nr.nodeId] = "running";
    });
    onStatuses(map);
  }, [result, playIndex, onStatuses]);

  // حرکت تصویری مسیر مثل n8n: یالِ «گره قبلی ← گره در حال اجرا» متحرک می‌شود و مسیر طی‌شده سبز می‌ماند
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  useEffect(() => {
    if (!result) return;
    const done = result.nodeRuns.slice(0, playIndex);
    const next = result.nodeRuns[playIndex];
    const travelingIds = new Set<string>();
    const traveledIds = new Set<string>();
    for (let i = 0; i + 1 < done.length; i++) {
      const a = done[i];
      const b = done[i + 1];
      edgesRef.current.forEach((e) => {
        if (e.source === a.nodeId && e.target === b.nodeId) traveledIds.add(e.id);
      });
    }
    if (next && done.length > 0) {
      const last = done[done.length - 1];
      edgesRef.current.forEach((e) => {
        if (e.source === last.nodeId && e.target === next.nodeId) travelingIds.add(e.id);
      });
    }
    setEdges((prev) => {
      let changed = false;
      const mapped = prev.map((e) => {
        const isGreen = e.style?.stroke === "#10b981";
        if (travelingIds.has(e.id)) {
          if (e.animated && isGreen) return e;
          changed = true;
          return { ...e, animated: true, style: { ...GREEN_EDGE.style }, markerEnd: GREEN_EDGE.marker() };
        }
        if (traveledIds.has(e.id)) {
          if (!e.animated && isGreen) return e;
          changed = true;
          return { ...e, animated: false, style: { ...GREEN_EDGE.style }, markerEnd: GREEN_EDGE.marker() };
        }
        if (isGreen || e.animated) {
          changed = true;
          const lbl = typeof e.label === "string" ? e.label : undefined;
          return { ...e, animated: false, style: undefined, ...edgeVisual(lbl) };
        }
        return e;
      });
      return changed ? mapped : prev;
    });
  }, [result, playIndex, setEdges]);

  const openConfig = useCallback((node: CrmFlowNode) => {
    setSelectedNodeId(node.id);
    setDraft({ ...node.data });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setDraft(null);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
  }, [setNodes]);

  const onConnect = useCallback(
    (c: Connection) => {
      const label = c.sourceHandle === "true" ? "بله" : c.sourceHandle === "false" ? "خیر" : undefined;
      setEdges((eds) => addEdge({ ...c, id: `e_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`, label, ...edgeVisual(label) }, eds));
    },
    [setEdges]
  );

  const addNode = useCallback(
    (t: (typeof WF_NODE_TYPES)[number]) => {
      const id = `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
      setNodes((nds) => [...nds, { id, type: "crm" as const, position: { x: 140 + (nds.length % 5) * 70, y: 90 + (nds.length % 4) * 80 }, data: { label: t.label, nodeType: t.type, description: t.desc } }]);
    },
    [setNodes]
  );

  /** افزودن گره با درگ‌انددراپ روی مختصات دقیق بوم */
  const addNodeAt = useCallback(
    (t: string, position: XYPosition) => {
      const meta = nodeMeta(t);
      const id = `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
      setNodes((nds) => [...nds, { id, type: "crm" as const, position, data: { label: meta.label, nodeType: meta.type, description: meta.desc } }]);
      toast.success(`گره «${meta.label}» روی بوم اضافه شد`);
    },
    [setNodes]
  );

  const patch = useCallback((p: Partial<CrmNodeData>) => setDraft((d) => (d ? { ...d, ...p } : d)), []);

  const applyConfig = useCallback(() => {
    if (!selectedNodeId || !draft) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...draft } } : n)));
    toast.success("تنظیمات گره اعمال شد");
  }, [selectedNodeId, draft, setNodes]);

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setDraft(null);
    toast.info("گره حذف شد");
  }, [selectedNodeId, setNodes, setEdges]);

  const focusNode = useCallback(
    (nodeId: string) => {
      const n = nodes.find((x) => x.id === nodeId);
      if (!n) return;
      setSelectedNodeId(nodeId);
      setDraft({ ...n.data });
      setNodes((nds) => nds.map((x) => ({ ...x, selected: x.id === nodeId })));
    },
    [nodes, setNodes]
  );

  const [publishing, setPublishing] = useState(false);
  const togglePublish = useCallback(async () => {
    if (!savedId) {
      toast.error("ابتدا فرایند را ذخیره کنید");
      return;
    }
    setPublishing(true);
    try {
      const wf = await jsonFetch<WorkflowDto>(`/api/workflows/${savedId}`, { method: "PUT", body: JSON.stringify({ isActive: !isActive }) });
      setIsActive(wf.isActive);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(wf.isActive ? "فرایند منتشر شد" : "انتشار فرایند لغو شد");
    } catch (e) {
      const msg = errMsg(e);
      if (/یافت نشد/.test(msg)) toast.error("این فرایند روی سرور یافت نشد — دکمه «ذخیره» را بزنید و دوباره انتشار دهید");
      else toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }, [savedId, isActive, qc]);

  const saveNow = useCallback(async (forceNew = false): Promise<string | null> => {
    if (!name.trim()) {
      toast.error("نام فرایند را وارد کنید");
      return null;
    }
    if (!nodes.some((n) => str(n.data.nodeType) === "start")) {
      toast.error("فرایند بدون گره شروع قابل ذخیره نیست");
      return null;
    }
    setSaving(true);
    try {
      const body = { name: name.trim(), description: workflow?.description ?? null, isActive: savedId ? isActive : true, nodes: toWfNodes(nodes), edges: toWfEdges(edges) };
      let wf: WorkflowDto | null = null;
      if (savedId && !forceNew) {
        try {
          wf = await jsonFetch<WorkflowDto>(`/api/workflows/${savedId}`, { method: "PUT", body: JSON.stringify(body) });
        } catch (e) {
          // فرایند روی سرور دیگر وجود ندارد (مثلاً بعد از ری‌استارت/ریست داده‌ها) — به‌جای خطا، نسخه جدید ساخته می‌شود
          if (!/یافت نشد/.test(errMsg(e))) throw e;
          toast.info("نسخه قبلی این فرایند روی سرور نبود — به‌عنوان نسخه جدید ذخیره شد");
        }
      }
      if (!wf) {
        wf = await jsonFetch<WorkflowDto>("/api/workflows", { method: "POST", body: JSON.stringify(body) });
      }
      setSavedId(wf.id);
      setIsActive(wf.isActive);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("فرایند با موفقیت ذخیره شد");
      return wf.id;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    } finally {
      setSaving(false);
    }
  }, [name, nodes, edges, savedId, isActive, workflow?.description, qc]);

  const runTest = useCallback(async () => {
    if (running) return;
    setReportOpen(true);
    const id = savedId ?? (await saveNow());
    if (!id) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(testData || "{}") as Record<string, unknown>;
    } catch {
      toast.error("داده تستی باید JSON معتبر باشد");
      return;
    }
    if (firstCustomerId && !parsed.customerId) parsed.customerId = firstCustomerId;
    // تکمیل خودکار متغیرهای شرط‌ها در داده تستی — حتی اگر بعد از باز شدن طراح گره/شرط جدید اضافه شده باشد
    const filled = ensureConditionVars(parsed, toWfNodes(nodes));
    if (filled.added.length > 0) setTestData(JSON.stringify(filled.data, null, 2));
    setRunning(true);
    try {
      const r = await jsonFetch<RunResult>(`/api/workflows/${id}/run`, { method: "POST", body: JSON.stringify({ testData: filled.data }) });
      setResult(r);
      setPlayIndex(0);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      qc.invalidateQueries({ queryKey: ["workflow-detail", id] });
    } catch (e) {
      // «فرآیند یافت نشد» — مثلاً بعد از ری‌استارت سرور یا ریست داده‌ها (ID قدیمی مرورگر):
      // به‌جای نمایش خطا، فرایند به‌صورت نسخه جدید ذخیره و تست دوباره اجرا می‌شود
      if (/یافت نشد/.test(errMsg(e))) {
        const newId = await saveNow(true);
        if (newId) {
          try {
            const r = await jsonFetch<RunResult>(`/api/workflows/${newId}/run`, { method: "POST", body: JSON.stringify({ testData: filled.data }) });
            setResult(r);
            setPlayIndex(0);
            qc.invalidateQueries({ queryKey: ["workflows"] });
            qc.invalidateQueries({ queryKey: ["workflow-detail", newId] });
            toast.info("فرایند قبلی روی سرور نبود — نسخه جدید ذخیره شد و تست اجرا شد");
          } catch (e2) {
            toast.error(errMsg(e2));
          }
        }
      } else {
        toast.error(errMsg(e));
      }
    } finally {
      setRunning(false);
    }
  }, [running, savedId, saveNow, testData, firstCustomerId, nodes, qc]);

  // اجرای خودکار پس از «اجرای تست» از فهرست فرایندها
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRun && !autoRan.current) {
      autoRan.current = true;
      void runTest();
    }
  }, [autoRun, runTest]);

  const selNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="mt-4 space-y-3">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/50 p-2.5 shadow-sm">
        <Button type="button" onClick={() => void runTest()} disabled={running} className="gap-1.5 bg-amber-500 font-bold text-amber-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400">
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} تست فرایند
        </Button>
        <Button type="button" variant="outline" onClick={() => void saveNow()} disabled={saving} className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} ذخیره
        </Button>
        <Button type="button" variant="outline" onClick={() => void togglePublish()} disabled={!savedId || publishing} title={isActive ? "فرایند فعال است" : "فرایند غیرفعال است"} className="gap-1.5 text-muted-foreground">
          <Upload className="size-4" /> انتشار
          <span className={cn("size-1.5 rounded-full", isActive ? "bg-emerald-400" : "bg-zinc-500")} aria-hidden />
        </Button>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="فرایند: بدون نام" aria-label="نام فرایند" className="h-9 w-44 font-bold sm:w-56" />
        <Button type="button" variant="outline" onClick={onTemplate} className="gap-1.5"><LayoutTemplate className="size-4" /> قالب نمونه</Button>
        <Button type="button" variant="outline" onClick={onNew} className="gap-1.5"><Plus className="size-4" /> فرایند جدید</Button>
        <span className="ms-auto" />
        <Select value={savedId ?? undefined} onValueChange={onLoad}>
          <SelectTrigger aria-label="بارگذاری فرایند ذخیره‌شده" className="h-9 w-[170px] text-xs sm:w-[210px]">
            <SelectValue placeholder="فرایند ذخیره‌شده…" />
          </SelectTrigger>
          <SelectContent>
            {workflows.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">هنوز فرایندی ذخیره نشده است.</div>
            ) : (
              workflows.map((w) => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </div>

      {/* تنظیمات (راست) + بوم (وسط) + پالت (چپ) */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
        <div className="w-full shrink-0 xl:h-[56vh] xl:min-h-[440px] xl:w-60 xl:overflow-y-auto xl:pe-0.5">
          <ConfigPanel node={selNode} draft={draft} patch={patch} apply={applyConfig} remove={deleteSelected} />
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border bg-background shadow-sm">
          <ReactFlowProvider>
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={openConfig}
              onPaneClick={clearSelection}
              nodeTypes={nodeTypes}
              onDropType={addNodeAt}
            />
          </ReactFlowProvider>
        </div>
        <div className="w-full shrink-0 xl:h-[56vh] xl:min-h-[440px] xl:w-52 xl:overflow-hidden">
          <Palette onAdd={addNode} />
        </div>
      </div>

      <Legend />

      <ReportPanel
        key={result?.runId ?? "empty"}
        result={result}
        playIndex={playIndex}
        running={running}
        open={reportOpen}
        onToggle={() => setReportOpen((v) => !v)}
        testData={testData}
        onTestDataChange={setTestData}
        onInsertDefault={() => setTestData(buildDefaultTestData(nodes, firstCustomerId))}
        onFixNode={focusNode}
        onOpenHistory={() => setHistOpen(true)}
        canOpenHistory={!!savedId}
      />

      <RunsHistoryDrawer workflowId={savedId} open={histOpen} onOpenChange={setHistOpen} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// فرایندهای جاری — list mode
// ─────────────────────────────────────────────────────────────────

function WorkflowCard({ wf, index, onEdit, onRun, onDelete, deleting }: {
  wf: WorkflowDto; index: number; onEdit: () => void; onRun: () => void; onDelete: () => void; deleting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      onClick={onEdit}
      className="group cursor-pointer rounded-2xl border bg-card/60 p-4 transition hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-black/10"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold text-foreground">{wf.name}</h3>
        <Badge variant={wf.isActive ? "default" : "secondary"} className="shrink-0 text-[10px]">{wf.isActive ? "فعال" : "غیرفعال"}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-5 text-muted-foreground">{wf.description || "بدون توضیح"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{faNum(wf.runCount ?? 0)} اجرا</span>
        {wf.successRate !== null && wf.successRate !== undefined && <span>نرخ موفقیت {faPercent(wf.successRate)}</span>}
        {wf.lastRun && (
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 shrink-0 rounded-full", wf.lastRun.status === "failed" ? "bg-red-400" : "bg-emerald-400")} />
            آخرین اجرا {faDateTime(wf.lastRun.startedAt)}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center gap-1.5 border-t pt-3" onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="sm" className="h-7 flex-1 gap-1.5 text-xs" onClick={onEdit}><Pencil className="size-3.5" /> ویرایش</Button>
        <Button variant="secondary" size="sm" className="h-7 flex-1 gap-1.5 text-xs" onClick={onRun}><Play className="size-3.5" /> اجرای تست</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" disabled={deleting} onClick={() => setConfirmOpen(true)} aria-label={`حذف ${wf.name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>حذف فرایند «{wf.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>همه اجراهای ثبت‌شده این فرایند نیز حذف خواهند شد و قابل بازگشت نیست.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter dir="rtl">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => { setConfirmOpen(false); onDelete(); }}>حذف کن</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function ListView({ workflows, isLoading, deletingId, onNew, onTemplate, onEdit, onRun, onDelete }: {
  workflows: WorkflowDto[]; isLoading: boolean; deletingId: string | null;
  onNew: () => void; onTemplate: () => void; onEdit: (wf: WorkflowDto) => void; onRun: (wf: WorkflowDto) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
      ) : workflows.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="relative mb-5">
            <span className="pulse-dot absolute inset-0 rounded-full text-primary" aria-hidden />
            <span className="flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm"><WorkflowIcon className="size-8 text-primary" /></span>
          </div>
          <h3 className="text-lg font-bold">اولین فرایند خودکار خود را بسازید</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            گره‌ها را به هم وصل کنید، شرط بگذارید و با «تست فرایند» نتیجه واقعی را زنده ببینید — ساخت وظیفه، اطلاع‌رسانی و شاخه‌بندی مسیر.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={onNew} className="gap-1.5"><Plus className="size-4" /> ساختن فرایند</Button>
            <Button variant="outline" onClick={onTemplate} className="gap-1.5"><LayoutTemplate className="size-4" /> قالب نمونه</Button>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((wf, i) => (
            <WorkflowCard key={wf.id} wf={wf} index={i} deleting={deletingId === wf.id} onEdit={() => onEdit(wf)} onRun={() => onRun(wf)} onDelete={() => onDelete(wf.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Runs history drawer
// ─────────────────────────────────────────────────────────────────

function RunsHistoryDrawer({ workflowId, open, onOpenChange }: { workflowId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["workflow-detail", workflowId],
    queryFn: () => jsonFetch<WorkflowDetail>(`/api/workflows/${workflowId}`),
    enabled: open && !!workflowId,
  });
  const runs = q.data?.runs ?? [];
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[75vh]">
        <DrawerHeader dir="rtl" className="mx-auto w-full max-w-2xl text-right">
          <DrawerTitle className="flex items-center gap-2"><History className="size-4 text-primary" /> تاریخچه اجراها</DrawerTitle>
          <DrawerDescription className="text-right">۱۰ اجرای اخیر این فرایند — برای دیدن گره‌ها باز کنید.</DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="mx-auto h-[45vh] w-full max-w-2xl px-4 pb-8">
          {q.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">هنوز اجرایی ثبت نشده است.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.id} className="rounded-lg border bg-card/50">
                  <button type="button" onClick={() => setExpandedId((p) => (p === r.id ? null : r.id))} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-right">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: runStatusColor(r.status) }} />
                    <span className="text-xs font-medium">{faDateTime(r.startedAt)}</span>
                    <span className="text-[10px] text-muted-foreground">{faDuration(r.duration)}</span>
                    <Badge variant="secondary" className={cn("ms-auto text-[9px]", r.status === "success" && "text-emerald-400", r.status === "failed" && "text-red-400")}>
                      {r.status === "success" ? "موفق" : r.status === "failed" ? "ناموفق" : "در حال اجرا"}
                    </Badge>
                    <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expandedId === r.id && "rotate-180")} />
                  </button>
                  {expandedId === r.id && (
                    <div className="space-y-1.5 border-t px-3 py-2.5">
                      {(r.nodeRuns ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">گزارش گره‌ای موجود نیست.</p>}
                      {(r.nodeRuns ?? []).map((nr) => (
                        <div key={nr.id} className="flex items-center gap-2 text-[11px]">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: runStatusColor(nr.status) }} />
                          <span className="truncate">{nr.nodeName}</span>
                          {nr.error && <span className="truncate text-[10px] text-red-400">{nr.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────
// Module root — هدر + تب‌های پیل
// ─────────────────────────────────────────────────────────────────

export default function WorkflowsModule() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"designer" | "list">("designer");
  const [selected, setSelected] = useState<WorkflowDto | null>(() => templateWorkflow());
  const [editorKey, setEditorKey] = useState(1);
  const [autoRun, setAutoRun] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, WfNodeStatus>>({});

  const workflowsQ = useQuery({ queryKey: ["workflows"], queryFn: () => jsonFetch<WorkflowDto[]>("/api/workflows") });
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: () => jsonFetch<CustomerDto[]>("/api/customers") });
  const firstCustomerId = customersQ.data?.[0]?.id;

  const del = useMutation({
    mutationFn: (id: string) => jsonFetch<{ ok: boolean }>(`/api/workflows/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("فرایند حذف شد");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const openDesigner = useCallback((wf: WorkflowDto | null, withAutoRun = false) => {
    setSelected(wf);
    setAutoRun(withAutoRun);
    setEditorKey((k) => k + 1);
    setLiveStatuses({});
    setMode("designer");
  }, []);

  const openTemplate = useCallback(() => {
    setSelected(templateWorkflow());
    setAutoRun(false);
    setEditorKey((k) => k + 1);
    setLiveStatuses({});
    setMode("designer");
    toast.info("قالب نمونه بارگذاری شد — دکمه «تست فرایند» را بزنید");
  }, []);

  const handleStatuses = useCallback((m: Record<string, WfNodeStatus>) => setLiveStatuses(m), []);

  const handleLoad = useCallback(
    (id: string) => {
      const wf = (workflowsQ.data ?? []).find((w) => w.id === id);
      if (wf) openDesigner(wf);
    },
    [workflowsQ.data, openDesigner]
  );

  return (
    <NodeStatusContext.Provider value={liveStatuses}>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-foreground">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><WorkflowIcon className="size-5" /></span>
              اتوماسیون فرایندها
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">فرایندها را گرافیکی طراحی کنید و با «تست فرایند» اجرای واقعی را ببینید — گره سبز یعنی عبور به مرحله بعد، گره قرمز یعنی نیاز به اصلاح.</p>
          </div>
          <div className="inline-flex rounded-xl border bg-muted/40 p-1" role="tablist" aria-label="حالت نمایش فرایندها">
            <button type="button" role="tab" aria-selected={mode === "designer"} onClick={() => setMode("designer")}
              className={cn("rounded-lg px-4 py-1.5 text-xs font-bold transition", mode === "designer" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              طراح گرافیکی فرایند
            </button>
            <button type="button" role="tab" aria-selected={mode === "list"} onClick={() => setMode("list")}
              className={cn("rounded-lg px-4 py-1.5 text-xs font-bold transition", mode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              فرایندهای جاری
            </button>
          </div>
        </div>

        {mode === "designer" ? (
          <Designer
            key={editorKey}
            workflow={selected}
            workflows={workflowsQ.data ?? []}
            firstCustomerId={firstCustomerId}
            autoRun={autoRun}
            onStatuses={handleStatuses}
            onLoad={handleLoad}
            onTemplate={openTemplate}
            onNew={() => openDesigner(null)}
          />
        ) : (
          <ListView
            workflows={workflowsQ.data ?? []}
            isLoading={workflowsQ.isLoading}
            deletingId={del.variables ? String(del.variables) : null}
            onNew={() => openDesigner(null)}
            onTemplate={openTemplate}
            onEdit={(wf) => openDesigner(wf)}
            onRun={(wf) => openDesigner(wf, true)}
            onDelete={(id) => del.mutate(id)}
          />
        )}
      </div>
    </NodeStatusContext.Provider>
  );
}
