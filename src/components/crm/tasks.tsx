"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

import { useCrmStore } from "@/lib/crm-store";
import {
  TASK_PRIORITIES,
  faNum,
  faRelativeDue,
  priorityColor,
  priorityLabel,
} from "@/lib/format";
import type { CustomerDto, DealDto, TaskDto, TaskPriority, TaskStatus, UserDto } from "@/lib/types";

/* ────────────────────────────── shared bits ────────────────────────────── */

const STATUS_TABS = [
  { key: "all", label: "همه" },
  { key: "todo", label: "در انتظار" },
  { key: "in_progress", label: "در حال انجام" },
  { key: "done", label: "انجام‌شده" },
  { key: "urgent", label: "فوری" },
] as const;

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "در انتظار",
  in_progress: "در حال انجام",
  done: "انجام‌شده",
};

type BucketKey = "overdue" | "today" | "week" | "later" | "none" | "done";

const BUCKETS: { key: BucketKey; label: string; cls: string }[] = [
  { key: "overdue", label: "عقب‌افتاده", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { key: "today", label: "امروز و فردا", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  { key: "week", label: "این هفته", cls: "bg-primary/10 text-primary border-primary/30" },
  { key: "later", label: "بعداً", cls: "bg-muted text-muted-foreground border-border" },
  { key: "none", label: "بدون سررسید", cls: "bg-muted text-muted-foreground border-border" },
  { key: "done", label: "انجام‌شده", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function dueDiffDays(due?: string | null): number | null {
  if (!due) return null;
  return Math.round((startOfDay(new Date(due)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

function bucketOf(t: TaskDto): BucketKey {
  if (t.status === "done") return "done";
  const diff = dueDiffDays(t.dueDate);
  if (diff === null) return "none";
  if (diff < 0) return "overdue";
  if (diff <= 1) return "today";
  if (diff <= 6) return "week";
  return "later";
}

async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!r.ok) {
    let msg = "خطای غیرمنتظره‌ای رخ داد";
    try {
      const j = (await r.json()) as { error?: string };
      msg = j.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center gap-3 text-center" role="alert">
      <p className="text-sm text-destructive">خطا در دریافت وظایف. لطفاً دوباره تلاش کنید.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" aria-hidden />
        تلاش مجدد
      </Button>
    </div>
  );
}

/* ──────────────────────────── task dialog ──────────────────────────── */

interface TaskForm {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
  customerId: string;
  dealId: string;
}

const emptyForm: TaskForm = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  assigneeId: "",
  customerId: "",
  dealId: "",
};

function TaskDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TaskDto | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {open && (
          <TaskDialogBody
            key={editing?.id ?? "new"}
            editing={editing}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskDialogBody({
  editing,
  onClose,
}: {
  editing: TaskDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TaskForm>(() =>
    editing
      ? {
          title: editing.title,
          description: editing.description ?? "",
          status: editing.status,
          priority: editing.priority,
          dueDate: editing.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : "",
          assigneeId: editing.assigneeId ?? "",
          customerId: editing.customerId ?? "",
          dealId: editing.dealId ?? "",
        }
      : emptyForm
  );

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserDto[]>("/api/users"),
    staleTime: 60_000,
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => api<CustomerDto[]>("/api/customers"),
    staleTime: 60_000,
  });
  const { data: deals } = useQuery({
    queryKey: ["deals"],
    queryFn: () => api<DealDto[]>("/api/deals"),
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (f: TaskForm) => {
      const body = {
        title: f.title.trim(),
        description: f.description.trim() || null,
        status: f.status,
        priority: f.priority,
        dueDate: f.dueDate || null,
        assigneeId: f.assigneeId || null,
        customerId: f.customerId || null,
        dealId: f.dealId || null,
      };
      return editing
        ? api<TaskDto>(`/api/tasks/${editing.id}`, { method: "PUT", body })
        : api<TaskDto>("/api/tasks", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "وظیفه به‌روزرسانی شد" : "وظیفه جدید ایجاد شد");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "ویرایش وظیفه" : "وظیفه جدید"}</DialogTitle>
        <DialogDescription>
          {editing ? "جزئیات وظیفه را ویرایش کنید." : "عنوان وظیفه الزامی است؛ بقیه موارد اختیاری هستند."}
        </DialogDescription>
      </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pe-1 -me-1">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-title">عنوان</Label>
            <Input id="t-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثلاً تماس پیگیری پیش‌فاکتور" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-desc">توضیحات</Label>
            <Textarea id="t-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="شرح وظیفه…" />
          </div>
          <div className="space-y-1.5">
            <Label>وضعیت</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}>
              <SelectTrigger aria-label="وضعیت وظیفه"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>اولویت</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
              <SelectTrigger aria-label="اولویت وظیفه"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-due">سررسید</Label>
            <Input
              id="t-due"
              type="date"
              dir="ltr"
              className="text-left"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>مسئول</Label>
            <Select value={form.assigneeId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}>
              <SelectTrigger aria-label="مسئول وظیفه">
                <SelectValue placeholder="انتخاب مسئول" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>مشتری</Label>
            <Select value={form.customerId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}>
              <SelectTrigger aria-label="مشتری مرتبط">
                <SelectValue placeholder="انتخاب مشتری" />
              </SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>فرصت مرتبط</Label>
            <Select value={form.dealId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, dealId: v }))}>
              <SelectTrigger aria-label="فرصت مرتبط">
                <SelectValue placeholder="بدون فرصت" />
              </SelectTrigger>
              <SelectContent>
                {(deals ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button disabled={form.title.trim() === "" || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {saveMut.isPending ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت وظیفه"}
          </Button>
        </DialogFooter>
    </>
  );
}

/* ──────────────────────────── task row ──────────────────────────── */

function TaskRow({
  task,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  task: TaskDto;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const navigate = useCrmStore((s) => s.navigate);
  const done = task.status === "done";
  const rel = faRelativeDue(task.dueDate);
  const pColor = priorityColor(task.priority);

  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
      }}
      className={`rounded-xl border bg-card p-3.5 flex items-center gap-2 sm:gap-3 ${done ? "opacity-70" : ""}`}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        animate={{ scale: toggling ? [1, 0.85, 1] : 1 }}
        onClick={onToggle}
        disabled={toggling}
        aria-label={done ? `علامت‌گذاری «${task.title}» به‌عنوان در انتظار` : `علامت‌گذاری «${task.title}» به‌عنوان انجام‌شده`}
        className={`h-11 w-11 -m-1.5 shrink-0 rounded-full flex items-center justify-center transition-colors ${
          done ? "text-emerald-500 hover:text-emerald-400" : "text-muted-foreground/50 hover:text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </motion.button>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={`text-sm font-medium leading-5 ${done ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {task.description && !done && (
          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
            style={{ color: pColor, backgroundColor: `${pColor}14`, borderColor: `${pColor}33` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pColor }} aria-hidden />
            {priorityLabel(task.priority)}
          </span>
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tnum ${
                rel.overdue
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : rel.soon
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <CalendarClock className="h-3 w-3" aria-hidden />
              {rel.text}
            </span>
          )}
          {task.customer && (
            <button
              type="button"
              onClick={() => navigate("customers", { customerId: task.customer?.id ?? null })}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors max-w-[180px]"
              aria-label={`مشاهده مشتری ${task.customer.company}`}
            >
              <Building2 className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{task.customer.company}</span>
            </button>
          )}
          {task.deal && <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">↳ {task.deal.title}</span>}
        </div>
      </div>

      {task.assignee && (
        <span
          title={task.assignee.name}
          className="hidden sm:flex h-8 w-8 shrink-0 rounded-full items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: task.assignee.color }}
          aria-label={`مسئول: ${task.assignee.name}`}
        >
          {task.assignee.name.slice(0, 1)}
        </span>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground" aria-label={`ویرایش ${task.title}`} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-destructive" aria-label={`حذف ${task.title}`} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────── main module ──────────────────────────── */

type QuickFilter = "overdue" | "today" | "week" | "doneWeek" | null;

function StatCard({
  label,
  value,
  Icon,
  cls,
  active,
  onClick,
}: {
  label: string;
  value: number;
  Icon: typeof AlertTriangle;
  cls: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      aria-label={`فیلتر ${label}`}
      className={`rounded-xl border bg-card p-4 text-start transition-colors ${active ? "border-primary/50 ring-1 ring-primary/30" : "hover:border-border"} ${cls}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 opacity-70" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-bold tnum">{faNum(value)}</p>
    </motion.button>
  );
}

export default function TasksModule() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [quick, setQuick] = useState<QuickFilter>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskDto | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<UserDto[]>("/api/users"),
    staleTime: 60_000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", assignee],
    queryFn: () =>
      api<TaskDto[]>(`/api/tasks${assignee !== "all" ? `?assigneeId=${encodeURIComponent(assignee)}` : ""}`),
  });

  const tasks = useMemo(() => data ?? [], [data]);

  const applyFilters = (ts: TaskDto[]) => {
    let out = ts;
    if (statusTab === "urgent") out = out.filter((t) => t.priority === "urgent");
    else if (statusTab !== "all") out = out.filter((t) => t.status === statusTab);
    if (quick === "overdue") out = out.filter((t) => bucketOf(t) === "overdue");
    else if (quick === "today") out = out.filter((t) => bucketOf(t) === "today");
    else if (quick === "week") out = out.filter((t) => bucketOf(t) === "week");
    else if (quick === "doneWeek") out = out.filter((t) => t.status === "done");
    return out;
  };

  const filtered = useMemo(() => applyFilters(tasks), [tasks, statusTab, quick]);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    return {
      overdue: open.filter((t) => bucketOf(t) === "overdue").length,
      today: open.filter((t) => bucketOf(t) === "today").length,
      week: open.filter((t) => bucketOf(t) === "week").length,
      doneWeek: tasks.filter(
        (t) => t.status === "done" && Date.now() - new Date(t.createdAt).getTime() <= 7 * 86_400_000
      ).length,
    };
  }, [tasks]);

  const grouped = useMemo(() => {
    const g: Record<BucketKey, TaskDto[]> = { overdue: [], today: [], week: [], later: [], none: [], done: [] };
    for (const t of filtered) g[bucketOf(t)].push(t);
    return g;
  }, [filtered]);

  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api<TaskDto>(`/api/tasks/${id}`, { method: "PUT", body: { status } }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<TaskDto[]>(["tasks", assignee]);
      if (prev) qc.setQueryData<TaskDto[]>(["tasks", assignee], prev.map((t) => (t.id === id ? { ...t, status } : t)));
      return { prev };
    },
    onError: (_e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", assignee], ctx.prev);
      toast.error("تغییر وضعیت ناموفق بود");
    },
    onSuccess: () => toast.success("وضعیت وظیفه به‌روزرسانی شد"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`وظیفه «${deleteTarget?.title}» حذف شد`);
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: TaskDto) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const visibleBuckets = BUCKETS.filter((b) => grouped[b.key].length > 0);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">وظایف و پیگیری‌ها</h1>
        <Button onClick={openNew} className="gap-2 min-h-11">
          <Plus className="h-4 w-4" aria-hidden />
          وظیفه جدید
        </Button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="عقب‌افتاده" value={stats.overdue} Icon={AlertTriangle} cls={stats.overdue > 0 ? "text-destructive" : ""} active={quick === "overdue"} onClick={() => setQuick((q) => (q === "overdue" ? null : "overdue"))} />
        <StatCard label="امروز" value={stats.today} Icon={CalendarClock} cls="text-amber-500" active={quick === "today"} onClick={() => setQuick((q) => (q === "today" ? null : "today"))} />
        <StatCard label="این هفته" value={stats.week} Icon={CalendarDays} cls="text-primary" active={quick === "week"} onClick={() => setQuick((q) => (q === "week" ? null : "week"))} />
        <StatCard label="انجام‌شده این هفته" value={stats.doneWeek} Icon={CheckCheck} cls="text-emerald-500" active={quick === "doneWeek"} onClick={() => setQuick((q) => (q === "doneWeek" ? null : "doneWeek"))} />
      </div>

      {/* toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <Tabs
          value={statusTab}
          onValueChange={(v) => {
            setStatusTab(v);
            setQuick(null);
          }}
        >
          <TabsList className="w-full lg:w-auto grid grid-cols-5 h-auto">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs sm:text-sm px-2.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 lg:ms-auto">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Select
            value={assignee}
            onValueChange={(v) => {
              setAssignee(v);
              setQuick(null);
            }}
          >
            <SelectTrigger className="w-full sm:w-44 min-h-11" aria-label="فیلتر مسئول">
              <SelectValue placeholder="همه اعضا" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه اعضا</SelectItem>
              {(users ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: u.color }} aria-hidden />
                    {u.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* body */}
      {isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <>
          {quick && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>فیلتر فعال: {BUCKETS.find((b) => b.key === (quick === "doneWeek" ? "done" : quick))?.label}</span>
              <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setQuick(null)}>
                حذف فیلتر
              </Button>
            </div>
          )}

          <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="space-y-6">
            {visibleBuckets.length === 0 && (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <p className="text-sm text-muted-foreground">وظیفه‌ای با این فیلترها یافت نشد. 🎉</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {visibleBuckets.map((b) => {
                const items = grouped[b.key];
                const isDone = b.key === "done";
                const collapsed = isDone && doneCollapsed;
                return (
                  <motion.section
                    key={b.key}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const, staggerChildren: 0.05 } },
                    }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                    aria-label={b.label}
                  >
                    <button
                      type="button"
                      onClick={() => isDone && setDoneCollapsed((v) => !v)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${b.cls}`}
                      aria-expanded={!collapsed}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {isDone && (
                          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} aria-hidden />
                        )}
                        {b.label}
                      </span>
                      <Badge variant="secondary" className="rounded-full font-normal">{faNum(items.length)}</Badge>
                    </button>
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2.5">
                            {items.map((t) => (
                              <TaskRow
                                key={t.id}
                                task={t}
                                onEdit={() => openEdit(t)}
                                onDelete={() => setDeleteTarget(t)}
                                onToggle={() =>
                                  toggleMut.mutate({ id: t.id, status: t.status === "done" ? "todo" : "done" })
                                }
                                toggling={toggleMut.isPending && toggleMut.variables?.id === t.id}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف وظیفه</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{deleteTarget?.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && delMut.mutate(deleteTarget.id)}
              disabled={delMut.isPending}
            >
              {delMut.isPending ? "در حال حذف…" : "حذف قطعی"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
