"use client";

import "@xyflow/react/dist/style.css";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, ReactFlowProvider, addEdge, useNodesState, useEdgesState, type Connection, type Edge, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Bell, CheckCircle2, ChevronDown, FileJson, FlaskConical, GitBranch, Globe, History, ListTodo, Loader2, MousePointerClick, Pencil, Play, Plus, Save, Square, Timer, Trash2, TrendingUp, Workflow as WorkflowIcon, XCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEAL_STAGES, TASK_PRIORITIES, faDateTime, faDuration, faNum, faPercent, stageLabel } from "@/lib/format";
import { WF_NODE_TYPES } from "@/lib/types";
import type { CustomerDto, RunDto, WorkflowDto, WfEdge, WfNode } from "@/lib/types";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

/** نقشه وضعیت زنده گره‌ها در حین پخش اجرا (بین دیالوگ تست و بوم مشترک است) */
const NodeStatusContext = createContext<Record<string, WfNodeStatus>>({});
NodeStatusContext.displayName = "WfNodeStatus";

const CONDITION_VARS = ["dealValue", "customerName", "customerId", "dealId"] as const;

const ICONS: Record<string, LucideIcon> = { Play, Square, GitBranch, ListTodo, Bell, History, TrendingUp, Globe, Timer };
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
    label: typeof e.label === "string" ? e.label : undefined, animated: e.animated,
  }));
}

const edgeDecor = {
  labelStyle: { fill: "var(--foreground)", fontSize: 10, fontWeight: 600 } as CSSProperties,
  labelBgStyle: { fill: "var(--card)", fillOpacity: 0.92 } as CSSProperties,
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 6,
};

function toFlowEdges(edges: WfEdge[]): FlowEdge[] {
  return edges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined,
    label: e.label ?? undefined, animated: e.animated ?? true, ...edgeDecor,
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
// Custom React Flow node «crm»
// ─────────────────────────────────────────────────────────────────

function CrmNodeView({ id, data, selected }: NodeProps<CrmFlowNode>) {
  const statuses = useContext(NodeStatusContext);
  const status = statuses[id] ?? data.status;
  const meta = nodeMeta(str(data.nodeType));
  const Icon = ICONS[meta.icon] ?? WorkflowIcon;
  const isCondition = str(data.nodeType) === "condition";
  return (
    <div className={cn("wf-node relative rounded-xl border bg-card/95 shadow-sm backdrop-blur-sm", selected && "border-primary/60 ring-2 ring-primary/30", status === "success" && "wf-node-success", status === "failed" && "wf-node-failed", status === "running" && "wf-node-running")} style={{ width: 210 }}>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${meta.color}26`, color: meta.color }}>
          <Icon className="size-4" />
        </span>
        <span className="truncate text-[13px] font-bold text-foreground">{str(data.label) || meta.label}</span>
        <span className="ms-auto flex shrink-0 items-center">
          {status === "running" && <Loader2 className="size-3.5 animate-spin text-primary" />}
          {status === "success" && <CheckCircle2 className="size-3.5 text-emerald-400" />}
          {status === "failed" && <XCircle className="size-3.5 text-red-400" />}
        </span>
      </div>
      {str(data.description) ? <p className="line-clamp-2 px-3 pt-1 text-[11px] leading-5 text-muted-foreground">{data.description}</p> : null}
      <div className={cn("px-3 pb-2 pt-1.5", isCondition && "pb-6")}>
        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
          {meta.label}
        </span>
      </div>
      {isCondition && (
        <>
          <span className="absolute bottom-1.5 text-[9px] font-bold text-emerald-400" style={{ right: "13%" }}>بله</span>
          <span className="absolute bottom-1.5 text-[9px] font-bold text-red-400" style={{ left: "15%" }}>خیر</span>
        </>
      )}
      <Handle type="target" position={Position.Top} />
      {isCondition ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} style={{ right: "22%", borderColor: "#10b981" }} />
          <Handle id="false" type="source" position={Position.Bottom} style={{ left: "22%", borderColor: "#ef4444" }} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} />
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
            <Input dir="ltr" className="font-mono text-xs" placeholder="dealValue > 100000000" value={str(draft.expression)} onChange={(e) => patch({ expression: e.target.value })} />
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
            <Input value={str(draft.taskTitle)} placeholder="تماس پیگیری با {{customerName}}" onChange={(e) => patch({ taskTitle: e.target.value })} />
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
    case "notify":
      return (
        <Field label="متن اعلان">
          <Textarea rows={3} className="text-xs" value={str(draft.message)} placeholder="اعلان فرآیند…" onChange={(e) => patch({ message: e.target.value })} />
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
          <Field label="مدت تأخیر (میلی‌ثانیه)">
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
// LIST mode
// ─────────────────────────────────────────────────────────────────

function WorkflowCard({ wf, index, onEdit, onRun, onDelete, deleting }: {
  wf: WorkflowDto; index: number; onEdit: () => void; onRun: () => void; onDelete: () => void; deleting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      onClick={onEdit}
      className="group cursor-pointer rounded-xl border bg-card/60 p-4 transition hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-black/10"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold text-foreground">{wf.name}</h3>
        <Badge variant={wf.isActive ? "default" : "secondary"} className="shrink-0 text-[10px]">{wf.isActive ? "فعال" : "غیرفعال"}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-5 text-muted-foreground">{wf.description || "بدون توضیح"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{faNum(wf.runCount)} اجرا</span>
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
        <Button variant="secondary" size="sm" className="h-7 flex-1 gap-1.5 text-xs" onClick={onRun}><FlaskConical className="size-3.5" /> اجرای تست</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" disabled={deleting} onClick={() => setConfirmOpen(true)}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>حذف فرآیند «{wf.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>همه اجراهای ثبت‌شده این فرآیند نیز حذف خواهند شد و قابل بازگشت نیست.</AlertDialogDescription>
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

function ListView({ workflows, isLoading, deletingId, onNew, onEdit, onRun, onDelete }: {
  workflows: WorkflowDto[]; isLoading: boolean; deletingId: string | null;
  onNew: () => void; onEdit: (wf: WorkflowDto) => void; onRun: (wf: WorkflowDto) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">فرآیندساز اتوماسیون</h1>
          <p className="mt-1 text-sm text-muted-foreground">جریان‌های کاری بصری بسازید، با داده واقعی تست کنید و اجراها را قدم‌به‌قدم دنبال کنید.</p>
        </div>
        <Button onClick={onNew} className="gap-1.5"><Plus className="size-4" /> فرآیند جدید</Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : workflows.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="relative mb-5">
            <span className="pulse-dot absolute inset-0 rounded-full text-primary" aria-hidden />
            <span className="flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm"><WorkflowIcon className="size-8 text-primary" /></span>
          </div>
          <h3 className="text-lg font-bold">اولین فرآیند خودکار خود را بسازید</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            گره‌ها را به‌هم وصل کنید، شرط بگذارید و با یک کلیک اجرای واقعی ببینید — ساخت وظیفه، ثبت فعالیت، شرط‌گذاری روی داده‌ها و بیشتر.
          </p>
          <Button className="mt-5 gap-1.5" onClick={onNew}><Plus className="size-4" /> ساختن فرآیند</Button>
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
          <DrawerDescription className="text-right">۱۰ اجرای اخیر این فرآیند — برای دیدن گره‌ها باز کنید.</DrawerDescription>
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
// RUN dialog — تست واقعی فرآیند با پخش انیمیشنی
// ─────────────────────────────────────────────────────────────────

function RunDialog({ workflow, open, onOpenChange, firstCustomerId, onGoToNode, onStatuses }: {
  workflow: WorkflowDto | null; open: boolean; onOpenChange: (v: boolean) => void;
  firstCustomerId?: string; onGoToNode: (nodeId: string) => void; onStatuses: (m: Record<string, WfNodeStatus>) => void;
}) {
  const qc = useQueryClient();
  const template = useMemo(
    () => JSON.stringify(firstCustomerId ? { dealValue: 150000000, customerName: "شرکت پارس فناوری", customerId: firstCustomerId } : { dealValue: 150000000, customerName: "شرکت پارس فناوری" }, null, 2),
    [firstCustomerId]
  );
  // کامپوننت با key در ماژول ریشه remount می‌شود → این مقادیر در هر بازشدن تازه می‌شوند
  const [testData, setTestData] = useState(template);
  const [result, setResult] = useState<RunResult | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

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

  // نگاشت playIndex → وضعیت هر گره (روی بوم ویرایشگر از طریق Context اعمال می‌شود)
  useEffect(() => {
    if (!result) return;
    const map: Record<string, WfNodeStatus> = {};
    result.nodeRuns.forEach((nr, i) => {
      if (i < playIndex) map[nr.nodeId] = nr.status === "failed" ? "failed" : "success";
      else if (i === playIndex) map[nr.nodeId] = "running";
    });
    onStatuses(map);
  }, [result, playIndex, onStatuses]);

  const run = useMutation({
    mutationFn: (id: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(testData || "{}");
      } catch {
        throw new Error("داده تستی باید JSON معتبر باشد");
      }
      return jsonFetch<RunResult>(`/api/workflows/${id}/run`, { method: "POST", body: JSON.stringify({ testData: parsed }) });
    },
    onSuccess: (r) => {
      setResult(r);
      setPlayIndex(0);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      qc.invalidateQueries({ queryKey: ["workflow-detail", workflow?.id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-[95vw] flex-col gap-4 sm:max-w-5xl">
        <DialogHeader dir="rtl" className="shrink-0 text-right">
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="size-4 text-primary" /> تست فرآیند — {workflow?.name}</DialogTitle>
          <DialogDescription className="text-right">شرط‌ها با داده تستی ارزیابی می‌شوند؛ وظیفه‌ها و فعالیت‌ها واقعاً در سیستم ساخته می‌شوند.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:flex-row">
          {/* پنل مسیر اجرا — در RTL سمت راست */}
          <div className="flex w-full min-h-0 shrink-0 flex-col border-t pt-3 lg:w-80 lg:border-t-0 lg:border-l lg:pt-0 lg:ps-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><GitBranch className="size-3.5" /> مسیر اجرا</h4>
            <ScrollArea className="min-h-0 flex-1">
              {!result ? (
                <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">پس از اجرا، مسیر گره‌به‌گره این‌جا نمایش داده می‌شود.</p>
              ) : (
                <div className="relative space-y-3 py-1">
                  <span className="absolute bottom-2 right-[11px] top-2 w-px bg-border" aria-hidden />
                  {result.nodeRuns.map((nr, i) => {
                    if (i > playIndex) return null; // نمایش تدریجی در حین پخش
                    const st = i < playIndex ? nr.status : "running";
                    const isFailed = st === "failed";
                    const dur = nr.startedAt && nr.finishedAt ? faDuration(new Date(nr.finishedAt).getTime() - new Date(nr.startedAt).getTime()) : null;
                    const logs = parseJsonArr(nr.logs);
                    return (
                      <motion.div key={nr.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                        <button type="button" onClick={() => setExpandedStep((p) => (p === nr.id ? null : nr.id))} className="relative flex w-full items-center gap-2.5 rounded-lg border bg-card/60 px-3 py-2 text-right transition hover:border-primary/40">
                          <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
                            {st === "running" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                            {st === "success" && <CheckCircle2 className="size-3.5 text-emerald-400" />}
                            {isFailed && <XCircle className="size-3.5 text-red-400" />}
                            {st === "running" && <span className="pulse-dot absolute inset-0 rounded-full text-primary" aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold">{nr.nodeName}</span>
                            {dur && <span className="block text-[10px] text-muted-foreground">{dur}</span>}
                          </span>
                          {isFailed && <Badge variant="destructive" className="shrink-0 text-[9px]">خطا</Badge>}
                          <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expandedStep === nr.id && "rotate-180")} />
                        </button>
                        {expandedStep === nr.id && (
                          <div className="mt-1 space-y-2 rounded-lg border bg-background/60 p-2.5">
                            {logs.length > 0 && (
                              <ul className="space-y-1">
                                {logs.map((l, li) => <li key={li} className="text-[11px] leading-5 text-muted-foreground">• {l}</li>)}
                              </ul>
                            )}
                            {isFailed && (
                              <div className="space-y-2">
                                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] leading-5 text-red-400">{nr.error}</div>
                                {result.failureHint && <p className="text-[11px] leading-5 text-muted-foreground">{result.failureHint}</p>}
                                {playbackDone && (
                                  <Button size="sm" variant="outline" className="h-7 w-full gap-1.5 text-[11px]" onClick={() => onGoToNode(nr.nodeId)}>
                                    <Pencil className="size-3" /> رفتن به ویرایشگر و اصلاح این گره
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
          {/* ناحیه اصلی: داده تستی + نتیجه */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-0.5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">داده تستی (JSON)</Label>
                <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={() => setTestData(template)}>
                  <FileJson className="size-3" /> درج داده پیش‌فرض
                </Button>
              </div>
              <Textarea dir="ltr" spellCheck={false} className="h-28 resize-none font-mono text-xs" value={testData} onChange={(e) => setTestData(e.target.value)} />
              <p className="text-[11px] leading-5 text-muted-foreground">شرط‌ها با این داده ارزیابی می‌شوند؛ وظیفه‌ها واقعاً در سیستم ساخته می‌شوند.</p>
            </div>
            <Button className="w-full gap-1.5" disabled={run.isPending || !workflow} onClick={() => workflow && run.mutate(workflow.id)}>
              {run.isPending ? (<><Loader2 className="size-4 animate-spin" /> در حال اجرای فرآیند…</>) : (<><Play className="size-4" /> اجرای فرآیند</>)}
            </Button>
            {result && playbackDone && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {result.status === "success" ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                      <CheckCircle2 className="size-4 shrink-0" /> فرآیند با موفقیت اجرا شد در {faDuration(result.duration)}
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
                      <AlertCircle className="size-4 shrink-0" /> فرآیند در گره «{failedNode?.nodeName ?? "نامشخص"}» متوقف شد
                    </div>
                    {result.failureHint && <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{result.failureHint}</p>}
                    {failedNode && (
                      <Button size="sm" variant="outline" className="mt-2.5 h-7 gap-1.5 text-[11px]" onClick={() => onGoToNode(failedNode.nodeId)}>
                        <Pencil className="size-3" /> رفتن به ویرایشگر و اصلاح این گره
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
            {result && playbackDone && result.context && (
              <details className="rounded-xl border bg-card/40 px-3 py-2 text-xs">
                <summary className="cursor-pointer select-none text-muted-foreground">کانتکست نهایی اجرا</summary>
                <pre dir="ltr" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-muted-foreground">{JSON.stringify(result.context, null, 2)}</pre>
              </details>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────
// EDITOR mode
// ─────────────────────────────────────────────────────────────────

function WorkflowEditor({ workflow, onBack, focusNodeId, onRunTest }: {
  workflow: WorkflowDto | null; onBack: () => void; focusNodeId: string | null; onRunTest: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(workflow?.name ?? "");
  const [desc, setDesc] = useState(workflow?.description ?? "");
  const [savedId, setSavedId] = useState<string | null>(workflow?.id ?? null);
  // رسیدن از خطای اجرا → انتخاب مستقیم گره مقصر (بدون effect؛ کامپوننت با key remount می‌شود)
  const initialNodes = toFlowNodes(workflow?.nodes ?? [{ id: "start_1", type: "crm", position: { x: 260, y: 140 }, data: { label: "شروع", nodeType: "start", description: "نقطه آغاز فرآیند" } }]);
  const focusTarget = focusNodeId ? initialNodes.find((n) => n.id === focusNodeId) : undefined;
  const [nodes, setNodes, onNodesChange] = useNodesState<CrmFlowNode>(
    focusNodeId ? initialNodes.map((n) => ({ ...n, selected: n.id === focusNodeId })) : initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(workflow?.edges ?? []));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(focusTarget?.id ?? null);
  const [draft, setDraft] = useState<CrmNodeData | null>(focusTarget ? { ...focusTarget.data } : null);
  const [runsOpen, setRunsOpen] = useState(false);

  const nodeTypes = useMemo<NodeTypes>(() => ({ crm: CrmNodeView }), []);

  const openConfig = useCallback((node: CrmFlowNode) => {
    setSelectedNodeId(node.id);
    setDraft({ ...node.data });
  }, []);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => addEdge({ ...c, id: `e_${Date.now().toString(36)}`, animated: true, label: c.sourceHandle === "true" ? "بله" : c.sourceHandle === "false" ? "خیر" : undefined, ...edgeDecor }, eds));
    },
    [setEdges]
  );

  const addNode = useCallback(
    (t: (typeof WF_NODE_TYPES)[number]) => {
      const id = `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
      setNodes((nds) => [...nds, { id, type: "crm" as const, position: { x: 300 + (Math.random() * 80 - 40), y: 160 + (Math.random() * 80 - 40) }, data: { label: t.label, nodeType: t.type, description: t.desc } }]);
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

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: desc.trim() || null, isActive: true, nodes: toWfNodes(nodes), edges: toWfEdges(edges) };
      return savedId
        ? jsonFetch<WorkflowDto>(`/api/workflows/${savedId}`, { method: "PUT", body: JSON.stringify(body) })
        : jsonFetch<WorkflowDto>("/api/workflows", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (wf) => {
      setSavedId(wf.id);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("فرآیند با موفقیت ذخیره شد");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const handleSave = () => {
    if (!name.trim()) return void toast.error("نام فرآیند را وارد کنید");
    if (!nodes.some((n) => str(n.data.nodeType) === "start")) return void toast.error("فرآیند بدون گره شروع قابل ذخیره نیست");
    save.mutate();
  };

  const selNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="space-y-4">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}><ArrowRight className="size-4" /> بازگشت به فهرست</Button>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام فرآیند" className="h-9 w-48 font-bold" />
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="توضیح (اختیاری)" className="hidden h-9 w-56 text-xs md:block" />
        <span className="ms-auto" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRunsOpen(true)} disabled={!savedId}><History className="size-4" /> اجراهای اخیر</Button>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => (savedId ? onRunTest(savedId) : toast.error("برای اجرای تست، ابتدا فرآیند را ذخیره کنید"))}>
          <FlaskConical className="size-4" /> اجرای تست
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} ذخیره
        </Button>
      </div>
      {/* پالت + بوم */}
      <div className="flex flex-col gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[500px] lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 lg:w-72 lg:overflow-y-auto lg:pe-1">
          <div className="rounded-xl border bg-card/60 p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><MousePointerClick className="size-3.5" /> گره‌ها — برای افزودن کلیک کنید</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {WF_NODE_TYPES.map((t) => {
                const Icon = ICONS[t.icon] ?? WorkflowIcon;
                return (
                  <button key={t.type} type="button" onClick={() => addNode(t)} className="flex shrink-0 items-center gap-2 rounded-lg border bg-background/60 px-2.5 py-2 text-right transition hover:border-primary/50 hover:bg-accent/40 lg:w-full">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${t.color}26`, color: t.color }}><Icon className="size-3.5" /></span>
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-xs font-bold lg:whitespace-normal">{t.label}</span>
                      <span className="hidden truncate text-[10px] text-muted-foreground lg:block">{t.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {selNode && draft ? (
              <motion.div key={`cfg-${selNode.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.2 }} className="space-y-3 rounded-xl border bg-card/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold">تنظیمات گره</h3>
                  <Badge variant="secondary" className="text-[9px]">{nodeMeta(str(draft.nodeType)).label}</Badge>
                </div>
                <Field label="عنوان"><Input className="text-xs" value={str(draft.label)} onChange={(e) => patch({ label: e.target.value })} /></Field>
                <Field label="توضیح"><Textarea rows={2} className="text-xs" value={str(draft.description)} onChange={(e) => patch({ description: e.target.value })} /></Field>
                <ConfigFields nodeType={str(draft.nodeType)} draft={draft} patch={patch} />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-8 flex-1" onClick={applyConfig}>اعمال</Button>
                  <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={deleteSelected}><Trash2 className="size-3.5" /> حذف گره</Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="cfg-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-dashed p-4 text-center text-xs leading-6 text-muted-foreground">
                روی یک گره در بوم کلیک کنید تا تنظیماتش را ببینید.
                <br />
                گره‌ها را از دستگیره‌ها به هم بکشید تا وصل شوند.
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
        <div className="relative min-h-[500px] flex-1 overflow-hidden rounded-xl border bg-card/30 lg:h-full">
          <div dir="ltr" className="h-[60vh] lg:h-full">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes} edges={edges}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                onNodeClick={(_, node) => openConfig(node)}
                nodeTypes={nodeTypes}
                fitView fitViewOptions={{ padding: 0.25 }}
                nodesDraggable deleteKeyCode={["Backspace", "Delete"]}
                minZoom={0.25} proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.6} color="color-mix(in oklab, var(--muted-foreground) 35%, transparent)" />
                <Controls showInteractive={false} position="bottom-right" />
                <MiniMap pannable zoomable style={{ width: 140, height: 100 }} maskColor="color-mix(in oklab, var(--card) 60%, transparent)" nodeColor={(n) => nodeMeta(str((n.data as CrmNodeData)?.nodeType)).color} nodeStrokeColor="transparent" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
      </div>
      <RunsHistoryDrawer workflowId={savedId} open={runsOpen} onOpenChange={setRunsOpen} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Module root
// ─────────────────────────────────────────────────────────────────

export default function WorkflowsModule() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [selected, setSelected] = useState<WorkflowDto | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<WorkflowDto | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, WfNodeStatus>>({});

  const workflowsQ = useQuery({ queryKey: ["workflows"], queryFn: () => jsonFetch<WorkflowDto[]>("/api/workflows") });
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: () => jsonFetch<CustomerDto[]>("/api/customers") });
  const firstCustomerId = customersQ.data?.[0]?.id;

  const del = useMutation({
    mutationFn: (id: string) => jsonFetch<{ ok: boolean }>(`/api/workflows/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("فرآیند حذف شد");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const openEditor = useCallback((wf: WorkflowDto | null) => {
    setSelected(wf);
    setFocusNodeId(null);
    setMode("editor");
  }, []);

  const openRun = useCallback((wf: WorkflowDto) => {
    setRunTarget(wf);
    setRunOpen(true);
  }, []);

  const handleRunFromEditor = useCallback(
    (id: string) => {
      const wf = workflowsQ.data?.find((w) => w.id === id);
      if (!wf) return void toast.error("ابتدا فرآیند را ذخیره کنید");
      openRun(wf);
    },
    [workflowsQ.data, openRun]
  );

  const handleGoToNode = useCallback(
    (nodeId: string) => {
      if (!runTarget) return;
      const wf = workflowsQ.data?.find((w) => w.id === runTarget.id) ?? runTarget;
      setRunOpen(false);
      setLiveStatuses({});
      setSelected(wf);
      setFocusNodeId(nodeId);
      setMode("editor");
    },
    [runTarget, workflowsQ.data]
  );

  return (
    <NodeStatusContext.Provider value={liveStatuses}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        {mode === "list" ? (
          <ListView
            workflows={workflowsQ.data ?? []}
            isLoading={workflowsQ.isLoading}
            deletingId={del.variables ? String(del.variables) : null}
            onNew={() => openEditor(null)}
            onEdit={openEditor}
            onRun={openRun}
            onDelete={(id) => del.mutate(id)}
          />
        ) : (
          <WorkflowEditor
            key={selected?.id ?? "new"}
            workflow={selected}
            focusNodeId={focusNodeId}
            onBack={() => { setMode("list"); setSelected(null); setFocusNodeId(null); setLiveStatuses({}); }}
            onRunTest={handleRunFromEditor}
          />
        )}
      </div>
      <RunDialog
        key={runOpen ? "open" : "closed"}
        workflow={runTarget}
        open={runOpen}
        onOpenChange={(v) => { setRunOpen(v); if (!v) setLiveStatuses({}); }}
        firstCustomerId={firstCustomerId}
        onGoToNode={handleGoToNode}
        onStatuses={setLiveStatuses}
      />
    </NodeStatusContext.Provider>
  );
}
