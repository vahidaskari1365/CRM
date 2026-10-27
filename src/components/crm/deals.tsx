"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Building2,
  CalendarDays,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Slider } from "@/components/ui/slider";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

import { useCrmStore } from "@/lib/crm-store";
import {
  DEAL_STAGES,
  faDate,
  faMoney,
  faNum,
  faPercent,
  stageColor,
  stageLabel,
} from "@/lib/format";
import type { CustomerDto, DealDto, DealStage } from "@/lib/types";

/* ────────────────────────────── shared bits ────────────────────────────── */

const SOURCES = ["وبسایت", "نمایشگاه", "معرفی مشتری", "تماس سرد", "مناقصه", "سایر"] as const;

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const fadeItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

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
      <p className="text-sm text-destructive">خطا در دریافت فرصت‌ها. لطفاً دوباره تلاش کنید.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" aria-hidden />
        تلاش مجدد
      </Button>
    </div>
  );
}

const toDateInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/* ──────────────────────────── deal dialog ──────────────────────────── */

interface DealForm {
  title: string;
  customerId: string;
  value: string;
  stage: DealStage;
  probability: number;
  source: string;
  expectedClose: string;
  description: string;
}

function DealDialog({
  open,
  onOpenChange,
  editing,
  defaultStage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: DealDto | null;
  defaultStage?: DealStage;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {open && (
          <DealDialogBody
            key={`${editing?.id ?? "new"}-${defaultStage ?? "lead"}`}
            editing={editing}
            defaultStage={defaultStage}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DealDialogBody({
  editing,
  defaultStage,
  onClose,
}: {
  editing: DealDto | null;
  defaultStage?: DealStage;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<DealForm>(() =>
    editing
      ? {
          title: editing.title,
          customerId: editing.customerId,
          value: String(editing.value ?? ""),
          stage: editing.stage,
          probability: editing.probability,
          source: editing.source ?? "",
          expectedClose: toDateInput(editing.expectedClose),
          description: editing.description ?? "",
        }
      : {
          title: "",
          customerId: "",
          value: "",
          stage: defaultStage ?? "lead",
          probability: 20,
          source: "",
          expectedClose: "",
          description: "",
        }
  );

  const { data: customers } = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => api<CustomerDto[]>("/api/customers"),
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (f: DealForm) => {
      const body = {
        title: f.title.trim(),
        customerId: f.customerId,
        value: Number(f.value.replace(/[^\d.-]/g, "")) || 0,
        stage: f.stage,
        probability: f.probability,
        source: f.source || null,
        expectedClose: f.expectedClose || null,
        description: f.description.trim() || null,
      };
      return editing
        ? api<DealDto>(`/api/deals/${editing.id}`, { method: "PUT", body })
        : api<DealDto>("/api/deals", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "فرصت به‌روزرسانی شد" : "فرصت جدید ایجاد شد");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.title.trim() !== "" && form.customerId !== "";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "ویرایش فرصت" : "فرصت جدید"}</DialogTitle>
        <DialogDescription>
          {editing ? "اطلاعات فرصت فروش را ویرایش کنید." : "مشخصات فرصت فروش جدید را وارد کنید. عنوان و مشتری الزامی است."}
        </DialogDescription>
      </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pe-1 -me-1">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="d-title">عنوان فرصت</Label>
            <Input id="d-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثلاً استقرار CRM سازمانی" />
          </div>
          <div className="space-y-1.5">
            <Label>مشتری</Label>
            <Select value={form.customerId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}>
              <SelectTrigger aria-label="مشتری">
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
            <Label htmlFor="d-value">ارزش قرارداد</Label>
            <div className="relative">
              <Input
                id="d-value"
                type="number"
                min={0}
                dir="ltr"
                className="text-left pe-16 tnum"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="0"
              />
              <span className="absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground pointer-events-none">تومان</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>مرحله</Label>
            <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v as DealStage }))}>
              <SelectTrigger aria-label="مرحله">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>منشأ</Label>
            <Select value={form.source || undefined} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
              <SelectTrigger aria-label="منشأ">
                <SelectValue placeholder="انتخاب منشأ" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>احتمال موفقیت</Label>
              <span className="text-sm font-medium text-primary tnum">{faPercent(form.probability)}</span>
            </div>
            <Slider
              value={[form.probability]}
              onValueChange={(v) => setForm((f) => ({ ...f, probability: v[0] ?? 0 }))}
              min={0}
              max={100}
              step={5}
              aria-label="احتمال موفقیت"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-close">سررسید پیش‌بینی‌شده</Label>
            <Input
              id="d-close"
              type="date"
              dir="ltr"
              className="text-left"
              value={form.expectedClose}
              onChange={(e) => setForm((f) => ({ ...f, expectedClose: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="d-desc">توضیحات</Label>
            <Textarea id="d-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="شرح فرصت، نیاز مشتری و…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button disabled={!canSave || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {saveMut.isPending ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت فرصت"}
          </Button>
        </DialogFooter>
    </>
  );
}

/* ──────────────────────────── delete confirm ──────────────────────────── */

function DealDeleteAlert({
  target,
  onOpenChange,
}: {
  target: DealDto | null;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean }>(`/api/deals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`فرصت «${target?.title}» حذف شد`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف فرصت</AlertDialogTitle>
          <AlertDialogDescription>
            آیا از حذف «{target?.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => target && delMut.mutate(target.id)}
            disabled={delMut.isPending}
          >
            {delMut.isPending ? "در حال حذف…" : "حذف قطعی"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ──────────────────────────── deal card ──────────────────────────── */

function DealCard({
  deal,
  justWon,
  onOpen,
  onNavigateCustomer,
}: {
  deal: DealDto;
  justWon: boolean;
  onOpen: () => void;
  onNavigateCustomer: () => void;
}) {
  return (
    /* نکته: framer-motion رویداد onDragStart بومی را فیلتر می‌کند؛
       بنابراین درگ HTML5 روی div بیرونی و انیمیشن روی motion داخلی است */
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("dealId", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      role="button"
      aria-label={`فرصت ${deal.title}`}
      className="group relative cursor-grab active:cursor-grabbing rounded-xl border bg-card select-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
      style={{ borderTopWidth: 4, borderTopColor: stageColor(deal.stage) }}
    >
    <motion.div
      layout
      variants={fadeItem}
      initial="hidden"
      animate={{ opacity: 1, y: 0, scale: justWon ? [1, 1.06, 1] : 1 }}
      transition={{ layout: { type: "spring", stiffness: 380, damping: 32 }, duration: 0.25 }}
      className="p-3.5 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium leading-5 line-clamp-2 flex-1">{deal.title}</p>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
      </div>
      {deal.customer && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateCustomer();
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors min-w-0 max-w-full"
          aria-label={`مشاهده مشتری ${deal.customer.company}`}
        >
          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{deal.customer.company}</span>
        </button>
      )}
      <p className="text-sm font-bold">{faMoney(deal.value)}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>احتمال</span>
          <span className="tnum">{faNum(deal.probability)}٪</span>
        </div>
        <Progress value={deal.probability} className="h-1" aria-label={`احتمال موفقیت ${deal.title}`} />
      </div>
      {deal.expectedClose && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" aria-hidden />
          {faDate(deal.expectedClose)}
        </div>
      )}
    </motion.div>
    </div>
  );
}

/* ──────────────────────────── main module ──────────────────────────── */

type SortKey = "value" | "stage" | "createdAt" | "expectedClose";

export default function DealsModule() {
  const qc = useQueryClient();
  const navigate = useCrmStore((s) => s.navigate);

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealDto | null>(null);
  const [defaultStage, setDefaultStage] = useState<DealStage>("lead");
  const [deleteTarget, setDeleteTarget] = useState<DealDto | null>(null);
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  const [justWonId, setJustWonId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["deals"],
    queryFn: () => api<DealDto[]>("/api/deals"),
  });

  const deals = data ?? [];
  const pipelineValue = useMemo(
    () => deals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + d.value, 0),
    [deals]
  );

  const sorted = useMemo(() => {
    const stageOrder = Object.fromEntries(DEAL_STAGES.map((s, i) => [s.key, i])) as Record<string, number>;
    return [...deals].sort((a, b) => {
      const { key, dir } = sort;
      let cmp = 0;
      if (key === "value") cmp = a.value - b.value;
      else if (key === "stage") cmp = (stageOrder[a.stage] ?? 0) - (stageOrder[b.stage] ?? 0);
      else if (key === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else cmp = new Date(a.expectedClose ?? 0).getTime() - new Date(b.expectedClose ?? 0).getTime();
      return cmp * dir;
    });
  }, [deals, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));

  const stageMut = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) =>
      api<DealDto>(`/api/deals/${id}`, { method: "PUT", body: { stage } }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["deals"] });
      const prev = qc.getQueryData<DealDto[]>(["deals"]);
      if (prev) qc.setQueryData<DealDto[]>(["deals"], prev.map((d) => (d.id === id ? { ...d, stage } : d)));
      return { prev };
    },
    onError: (_e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deals"], ctx.prev);
      toast.error("انتقال فرصت ناموفق بود");
    },
    onSuccess: (_d, v) => {
      toast.success(`فرصت به مرحله «${stageLabel(v.stage)}» منتقل شد`);
      if (v.stage === "won") {
        setJustWonId(v.id);
        setTimeout(() => setJustWonId(null), 900);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const openNew = (stage?: DealStage) => {
    setEditing(null);
    setDefaultStage(stage ?? "lead");
    setDialogOpen(true);
  };
  const openEdit = (d: DealDto) => {
    setEditing(d);
    setDialogOpen(true);
  };

  const handleDrop = (stage: DealStage, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("dealId");
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    stageMut.mutate({ id, stage });
  };

  const rowActions = (d: DealDto) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground" aria-label={`ویرایش ${d.title}`} onClick={() => openEdit(d)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-destructive" aria-label={`حذف ${d.title}`} onClick={() => setDeleteTarget(d)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const sortHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      aria-label={`مرتب‌سازی بر اساس ${label}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sort.key === key ? "text-primary" : "text-muted-foreground/50"}`} aria-hidden />
    </button>
  );

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">فرصت‌های فروش</h1>
          <Badge variant="outline" className="rounded-full bg-primary/10 border-primary/30 text-primary gap-1.5 font-medium">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            {faMoney(pipelineValue)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
            <TabsList>
              <TabsTrigger value="kanban" className="text-xs sm:text-sm">کانبان</TabsTrigger>
              <TabsTrigger value="table" className="text-xs sm:text-sm">جدول</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => openNew()} className="gap-2 min-h-11">
            <Plus className="h-4 w-4" aria-hidden />
            فرصت جدید
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[260px] flex-1 space-y-3 rounded-xl border bg-muted/20 p-3">
              <Skeleton className="h-5 w-24 shimmer" />
              <Skeleton className="h-24 w-full rounded-xl shimmer" />
              <Skeleton className="h-24 w-full rounded-xl shimmer" />
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">هنوز فرصتی ثبت نشده است.</p>
          <Button variant="outline" size="sm" onClick={() => openNew()} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            ثبت اولین فرصت
          </Button>
        </div>
      ) : view === "kanban" ? (
        /* ── kanban board ── */
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {DEAL_STAGES.map((s) => {
            const items = deals.filter((d) => d.stage === s.key);
            const sum = items.reduce((acc, d) => acc + d.value, 0);
            return (
              <div
                key={s.key}
                className={`kanban-col flex-1 min-w-[260px] rounded-xl border bg-muted/20 p-2.5 space-y-2.5 ${dragOver === s.key ? "drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(s.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((cur) => (cur === s.key ? null : cur));
                }}
                onDrop={(e) => handleDrop(s.key, e)}
              >
                <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                    <span className="text-sm font-medium truncate">{s.label}</span>
                    <Badge variant="secondary" className="rounded-full px-2 text-[11px] font-normal">{faNum(items.length)}</Badge>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground px-1.5 tnum">{faMoney(sum)}</p>
                <motion.div variants={staggerContainer} className="space-y-2.5 min-h-[80px]">
                  {items.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      justWon={justWonId === d.id}
                      onOpen={() => openEdit(d)}
                      onNavigateCustomer={() => navigate("customers", { customerId: d.customerId })}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/60 text-center py-4">فرصتی در این مرحله نیست</p>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── table view ── */
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-start">عنوان</TableHead>
                  <TableHead className="text-start">مشتری</TableHead>
                  <TableHead className="text-start">{sortHeader("value", "ارزش")}</TableHead>
                  <TableHead className="text-start">{sortHeader("stage", "مرحله")}</TableHead>
                  <TableHead className="text-start">احتمال</TableHead>
                  <TableHead className="text-start">{sortHeader("expectedClose", "سررسید")}</TableHead>
                  <TableHead className="text-start w-32">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openEdit(d)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stageColor(d.stage) }} aria-hidden />
                        <span className="font-medium text-sm">{d.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.customer?.company ?? "—"}</TableCell>
                    <TableCell className="text-sm font-bold">{faMoney(d.value)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal" style={{ color: stageColor(d.stage), borderColor: `${stageColor(d.stage)}55` }}>
                        {stageLabel(d.stage)}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-28">
                      <div className="flex items-center gap-2">
                        <Progress value={d.probability} className="h-1.5 flex-1" aria-label="احتمال موفقیت" />
                        <span className="text-xs text-muted-foreground tnum">{faNum(d.probability)}٪</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{faDate(d.expectedClose)}</TableCell>
                    <TableCell>{rowActions(d)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* mobile cards for table view */}
          <div className="md:hidden space-y-3">
            {sorted.map((d) => (
              <motion.div
                key={d.id}
                variants={fadeItem}
                className="rounded-xl border bg-card p-4 space-y-2.5 cursor-pointer"
                style={{ borderTopWidth: 4, borderTopColor: stageColor(d.stage) }}
                onClick={() => openEdit(d)}
                role="button"
                aria-label={`فرصت ${d.title}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2">{d.title}</p>
                  <Badge variant="outline" className="font-normal shrink-0" style={{ color: stageColor(d.stage), borderColor: `${stageColor(d.stage)}55` }}>
                    {stageLabel(d.stage)}
                  </Badge>
                </div>
                {d.customer && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" aria-hidden />
                    {d.customer.company}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{faMoney(d.value)}</p>
                  <span className="text-xs text-muted-foreground">{faDate(d.expectedClose)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Progress value={d.probability} className="h-1.5 flex-1 me-3" aria-label="احتمال موفقیت" />
                  {rowActions(d)}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} defaultStage={defaultStage} />
      <DealDeleteAlert target={deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)} />
    </div>
  );
}
