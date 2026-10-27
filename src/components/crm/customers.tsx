"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarDays,
  Building2,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ACTIVITY_TYPES,
  faDate,
  faDateLong,
  faMoney,
  faNum,
  stageColor,
  stageLabel,
} from "@/lib/format";
import type {
  ActivityDto,
  ContactDto,
  CustomerDto,
  DealDto,
  QuoteDto,
  TaskDto,
} from "@/lib/types";

/* ────────────────────────────── shared bits ────────────────────────────── */

const INDUSTRIES = [
  "فناوری اطلاعات",
  "بازرگانی",
  "مواد غذایی",
  "سلامت",
  "راه و ساختمان",
  "مد و پوشاک",
  "حمل و نقل",
  "آموزش",
  "انرژی",
  "چاپ",
  "سایر",
] as const;

const STATUS_TABS = [
  { key: "all", label: "همه" },
  { key: "active", label: "فعال" },
  { key: "lead", label: "سرنخ" },
  { key: "inactive", label: "غیرفعال" },
] as const;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "فعال", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  lead: { label: "سرنخ", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  inactive: { label: "غیرفعال", cls: "bg-muted text-muted-foreground border-border" },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
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

type CustomerDetail = CustomerDto & {
  contacts: ContactDto[];
  deals: DealDto[];
  activity: ActivityDto[];
  tasks: TaskDto[];
  quotes: QuoteDto[];
};

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center gap-3 text-center" role="alert">
      <p className="text-sm text-destructive">خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2"><RefreshCw className="h-4 w-4" aria-hidden />تلاش مجدد</Button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={`${meta.cls} font-medium`}>{meta.label}</Badge>;
}

/* ────────────────────────── add / edit dialog ────────────────────────── */

interface CustomerForm {
  name: string;
  company: string;
  phone: string;
  email: string;
  industry: string;
  city: string;
  address: string;
  status: string;
  tags: string;
  notes: string;
}

const emptyForm: CustomerForm = {
  name: "",
  company: "",
  phone: "",
  email: "",
  industry: "",
  city: "",
  address: "",
  status: "active",
  tags: "",
  notes: "",
};

function toForm(c: CustomerDto): CustomerForm {
  return {
    name: c.name ?? "",
    company: c.company ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    industry: c.industry ?? "",
    city: c.city ?? "",
    address: c.address ?? "",
    status: c.status ?? "active",
    tags: c.tags ?? "",
    notes: c.notes ?? "",
  };
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function CustomerDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CustomerDto | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {open && (
          <CustomerDialogBody
            key={editing?.id ?? "new"}
            editing={editing}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialogBody({
  editing,
  onClose,
}: {
  editing: CustomerDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CustomerForm>(() => (editing ? toForm(editing) : emptyForm));

  const set = (k: keyof CustomerForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: async (payload: CustomerForm) => {
      const body = {
        name: payload.name.trim(),
        company: payload.company.trim(),
        phone: payload.phone.trim(),
        email: orNull(payload.email),
        industry: orNull(payload.industry),
        city: orNull(payload.city),
        address: orNull(payload.address),
        status: payload.status,
        tags: orNull(payload.tags),
        notes: orNull(payload.notes),
      };
      return editing
        ? api<CustomerDto>(`/api/customers/${editing.id}`, { method: "PUT", body })
        : api<CustomerDto>("/api/customers", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editing ? "مشتری به‌روزرسانی شد" : "مشتری جدید ثبت شد");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.name.trim() !== "" && form.company.trim() !== "" && form.phone.trim() !== "";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "ویرایش مشتری" : "مشتری جدید"}</DialogTitle>
        <DialogDescription>
          {editing ? "اطلاعات مشتری را ویرایش کنید." : "اطلاعات مشتری جدید را وارد کنید. نام، شرکت و تلفن الزامی است."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pe-1 -me-1">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">نام رابط</Label>
            <Input id="c-name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="مثلاً علی نادری" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-company">شرکت</Label>
            <Input id="c-company" value={form.company} onChange={(e) => set("company")(e.target.value)} placeholder="مثلاً پارس فناوران داده" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">تلفن</Label>
            <Input id="c-phone" dir="ltr" className="text-left tnum" value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="021-88776655" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">ایمیل</Label>
            <Input id="c-email" dir="ltr" className="text-left" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="info@company.ir" />
          </div>
          <div className="space-y-1.5">
            <Label>صنعت</Label>
            <Select value={form.industry || undefined} onValueChange={set("industry")}>
              <SelectTrigger aria-label="صنعت"><SelectValue placeholder="انتخاب صنعت" /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-city">شهر</Label>
            <Input id="c-city" value={form.city} onChange={(e) => set("city")(e.target.value)} placeholder="تهران" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-address">آدرس</Label>
            <Input id="c-address" value={form.address} onChange={(e) => set("address")(e.target.value)} placeholder="تهران، خیابان ولیعصر" />
          </div>
          <div className="space-y-1.5">
            <Label>وضعیت</Label>
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger aria-label="وضعیت"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_TABS.filter((s) => s.key !== "all").map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-tags">تگ‌ها (با کاما جدا کنید)</Label>
            <Input id="c-tags" value={form.tags} onChange={(e) => set("tags")(e.target.value)} placeholder="کلیدی, VIP" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-notes">یادداشت</Label>
            <Textarea id="c-notes" rows={3} value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="یادداشت داخلی درباره مشتری…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button disabled={!canSave || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {saveMut.isPending ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت مشتری"}
          </Button>
        </DialogFooter>
    </>
  );
}

/* ──────────────────────────── delete confirm ──────────────────────────── */

function CustomerDeleteAlert({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: CustomerDto | null;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean }>(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.removeQueries({ queryKey: ["customer", id] });
      toast.success(`مشتری «${target?.company}» حذف شد`);
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف مشتری</AlertDialogTitle>
          <AlertDialogDescription>
            آیا از حذف «{target?.company}» مطمئن هستید؟ تمام فرصت‌ها، فعالیت‌ها و وظایف مرتبط نیز حذف خواهند شد و این عمل قابل بازگشت نیست.
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

/* ────────────────────────────── detail sheet ────────────────────────────── */

const ACTIVITY_ICONS: Record<string, { Icon: typeof Phone; color: string }> = {
  call: { Icon: Phone, color: "#8b5cf6" },
  meeting: { Icon: CalendarDays, color: "#f59e0b" },
  email: { Icon: Mail, color: "#10b981" },
  note: { Icon: StickyNote, color: "#6b7280" },
};

function CustomerDetailSheet({
  onEdit,
  onDelete,
}: {
  onEdit: (c: CustomerDto) => void;
  onDelete: (c: CustomerDto) => void;
}) {
  const openCustomerId = useCrmStore((s) => s.openCustomerId);
  const setOpenCustomerId = useCrmStore((s) => s.setOpenCustomerId);
  const [tab, setTab] = useState("overview");
  const [actForm, setActForm] = useState({ type: "call", title: "", content: "" });
  const [lastId, setLastId] = useState<string | null>(null);

  // الگوی «تنظیم وضعیت هنگام تغییر props» — ریست تب و فرم با تغییر مشتری
  if (openCustomerId !== lastId) {
    setLastId(openCustomerId);
    if (openCustomerId) {
      setTab("overview");
      setActForm({ type: "call", title: "", content: "" });
    }
  }
  const open = !!openCustomerId;

  const qc = useQueryClient();
  const { data: c, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer", openCustomerId],
    queryFn: () => api<CustomerDetail>(`/api/customers/${openCustomerId}`),
    enabled: open,
    // برای اینکه هنگام انیمیشن بستن شیت، محتوا پرش به اسکلتون نزند
    placeholderData: (prev) => prev,
  });

  const actMut = useMutation({
    mutationFn: () =>
      api<ActivityDto>(`/api/customers/${openCustomerId}/activities`, {
        method: "POST",
        body: { type: actForm.type, title: actForm.title.trim(), content: orNull(actForm.content) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", openCustomerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setActForm((f) => ({ ...f, title: "", content: "" }));
      toast.success("فعالیت ثبت شد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tags = useMemo(
    () => (c?.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    [c?.tags]
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) setOpenCustomerId(null); }}>
      <SheetContent side="left" className="w-full sm:max-w-xl p-0 gap-0 flex flex-col">
        {isLoading || !c ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full shimmer" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 shimmer" />
                <Skeleton className="h-3 w-24 shimmer" />
              </div>
            </div>
            <Skeleton className="h-9 w-full shimmer" />
            <Skeleton className="h-32 w-full rounded-xl shimmer" />
            <Skeleton className="h-24 w-full rounded-xl shimmer" />
          </div>
        ) : isError ? (
          <div className="p-6"><ErrorCard onRetry={() => refetch()} /></div>
        ) : (
          <>
            <SheetHeader className="p-5 border-b space-y-3 text-start">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-bold">
                    {c.company.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-base">{c.company}</SheetTitle>
                    <SheetDescription className="truncate">{c.name}</SheetDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="icon" className="h-11 w-11" aria-label="ویرایش مشتری" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 text-destructive hover:text-destructive" aria-label="حذف مشتری" onClick={() => onDelete(c)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={c.status} />
                {tags.map((t) => <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>)}
              </div>
            </SheetHeader>

            <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
              <div className="px-4 pt-3 border-b bg-muted/30">
                <TabsList className="grid grid-cols-4 w-full h-auto bg-transparent p-0">
                  {[
                    { k: "overview", l: "نمای کلی" },
                    { k: "deals", l: "فرصت‌ها" },
                    { k: "activity", l: "سوابق ارتباط" },
                    { k: "lists", l: "وظایف/پیش‌فاکتورها" },
                  ].map((t) => (
                    <TabsTrigger key={t.k} value={t.k} className="rounded-none border-b-2 border-transparent pb-2.5 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-xs sm:text-sm px-1">
                      {t.l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-5">
                  {/* ── نمای کلی ── */}
                  <TabsContent value="overview" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { Icon: Phone, label: "تلفن", value: c.phone, ltr: true },
                        { Icon: Mail, label: "ایمیل", value: c.email ?? "", ltr: true },
                        { Icon: Building2, label: "صنعت", value: c.industry ?? "", ltr: false },
                        { Icon: MapPin, label: "آدرس", value: c.address ?? "", ltr: false },
                        { Icon: CalendarDays, label: "تاریخ عضویت", value: faDateLong(c.createdAt), ltr: false },
                        { Icon: StickyNote, label: "شهر", value: c.city ?? "", ltr: false },
                      ].map((f) => (
                        <div key={f.label} className="rounded-xl border bg-card p-3 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <f.Icon className="h-3.5 w-3.5" aria-hidden />{f.label}
                          </div>
                          <p dir={f.ltr ? "ltr" : undefined} className={`text-sm break-words ${f.ltr ? "text-left tnum" : "text-start"}`}>{f.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StickyNote className="h-3.5 w-3.5" aria-hidden />
                        یادداشت‌ها
                      </div>
                      <p className="text-sm leading-6 whitespace-pre-wrap">{c.notes || "یادداشتی ثبت نشده است."}</p>
                    </div>
                    {c.contacts.length > 0 && (
                      <div className="rounded-xl border bg-card p-4 space-y-2">
                        <p className="text-xs text-muted-foreground">افراد رابط ({faNum(c.contacts.length)})</p>
                        {c.contacts.map((ct) => (
                          <div key={ct.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium">
                              {ct.name}
                              {ct.position ? <span className="text-muted-foreground font-normal"> — {ct.position}</span> : null}
                            </span>
                            {ct.phone ? <span dir="ltr" className="text-xs text-muted-foreground tnum">{ct.phone}</span> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ── فرصت‌ها ── */}
                  <TabsContent value="deals" className="mt-0 space-y-3">
                    {c.deals.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">هنوز فرصتی برای این مشتری ثبت نشده است.</p>
                    ) : (
                      c.deals.map((d) => (
                        <motion.div key={d.id} variants={fadeItem} initial="hidden" animate="show" className="rounded-xl border bg-card p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stageColor(d.stage) }} aria-hidden />
                              <p className="text-sm font-medium truncate">{d.title}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{stageLabel(d.stage)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold">{faMoney(d.value)}</p>
                            <span className="text-xs text-muted-foreground">احتمال {faNum(d.probability)}٪</span>
                          </div>
                          <Progress value={d.probability} className="h-1.5" aria-label={`احتمال موفقیت ${d.title}`} />
                        </motion.div>
                      ))
                    )}
                  </TabsContent>

                  {/* ── سوابق ارتباط ── */}
                  <TabsContent value="activity" className="mt-0 space-y-5">
                    <div className="relative space-y-4 ps-6">
                      <span className="absolute inset-y-1 start-[7px] w-px bg-border" aria-hidden />
                      {c.activity.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">هنوز فعالیتی ثبت نشده است.</p>
                      )}
                      {c.activity.map((a) => {
                        const meta = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.note;
                        return (
                          <motion.div key={a.id} variants={fadeItem} initial="hidden" animate="show" className="relative">
                            <span className="absolute -start-6 top-0.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center" style={{ backgroundColor: `${meta.color}26` }} aria-hidden>
                              <meta.Icon className="h-2.5 w-2.5" style={{ color: meta.color }} />
                            </span>
                            <div className="rounded-xl border bg-card p-3.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{a.title}</p>
                                <span className="text-[11px] text-muted-foreground shrink-0">{faDateLong(a.createdAt)}</span>
                              </div>
                              {a.content && <p className="text-xs leading-5 text-muted-foreground whitespace-pre-wrap">{a.content}</p>}
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  {ACTIVITY_TYPES.find((t) => t.key === a.type)?.label ?? a.type}
                                </span>
                                {a.user && (
                                  <span className="flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.user.color }} aria-hidden />
                                    {a.user.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-medium">افزودن فعالیت</p>
                      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                        <Select value={actForm.type} onValueChange={(v) => setActForm((f) => ({ ...f, type: v }))}>
                          <SelectTrigger aria-label="نوع فعالیت"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACTIVITY_TYPES.map((t) => (
                              <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={actForm.title}
                          onChange={(e) => setActForm((f) => ({ ...f, title: e.target.value }))}
                          placeholder="عنوان فعالیت، مثلاً تماس پیگیری"
                          aria-label="عنوان فعالیت"
                        />
                      </div>
                      <Textarea
                        rows={2}
                        value={actForm.content}
                        onChange={(e) => setActForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="شرح فعالیت (اختیاری)…"
                        aria-label="شرح فعالیت"
                      />
                      <Button size="sm" disabled={actForm.title.trim() === "" || actMut.isPending} onClick={() => actMut.mutate()}>
                        {actMut.isPending ? "در حال ثبت…" : "ثبت فعالیت"}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ── وظایف / پیش‌فاکتورها ── */}
                  <TabsContent value="lists" className="mt-0 space-y-4">
                    <div className="rounded-xl border bg-card p-4 space-y-2.5">
                      <p className="text-xs text-muted-foreground">وظایف ({faNum(c.tasks.length)})</p>
                      {c.tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">وظیفه‌ای ثبت نشده است.</p>
                      ) : c.tasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                          <span className={t.status === "done" ? "line-through text-muted-foreground" : "font-medium"}>{t.title}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{faDate(t.dueDate)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border bg-card p-4 space-y-2.5">
                      <p className="text-xs text-muted-foreground">پیش‌فاکتورها ({faNum(c.quotes.length)})</p>
                      {c.quotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">پیش‌فاکتوری صادر نشده است.</p>
                      ) : c.quotes.map((q) => (
                        <div key={q.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                          <span className="font-medium">پیش‌فاکتور {q.number}</span>
                          <span className="text-xs text-muted-foreground tnum">{faMoney(q.total)}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ────────────────────────────── main module ────────────────────────────── */

export default function CustomersModule() {
  const setOpenCustomerId = useCrmStore((s) => s.setOpenCustomerId);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerDto | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customers", q, status],
    queryFn: () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (status !== "all") p.set("status", status);
      const qs = p.toString();
      return api<CustomerDto[]>(`/api/customers${qs ? `?${qs}` : ""}`);
    },
  });

  const customers = data ?? [];

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: CustomerDto) => { setEditing(c); setDialogOpen(true); };

  const actions = (c: CustomerDto) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground" aria-label={`مشاهده ${c.company}`} onClick={() => setOpenCustomerId(c.id)}><Eye className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground" aria-label={`ویرایش ${c.company}`} onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-destructive" aria-label={`حذف ${c.company}`} onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">مشتریان</h1>
          <Badge variant="outline" className="rounded-full bg-muted/50 font-normal">{faNum(customers.length)} مشتری</Badge>
        </div>
        <Button onClick={openNew} className="gap-2 min-h-11">
          <Plus className="h-4 w-4" aria-hidden />
          مشتری جدید
        </Button>
      </div>

      {/* toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی مشتری…" aria-label="جستجوی مشتری" className="ps-9 min-h-11" />
        </div>
        <Tabs value={status} onValueChange={setStatus} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto grid grid-cols-4">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs sm:text-sm px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* body */}
      {isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl shimmer" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">مشتری‌ای یافت نشد.</p>
          <Button variant="outline" size="sm" onClick={openNew} className="gap-2"><Plus className="h-4 w-4" aria-hidden />ثبت اولین مشتری</Button>
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" key={`${q}-${status}`}>
          {/* desktop table */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-start">مشتری</TableHead>
                  <TableHead className="text-start">صنعت / شهر</TableHead>
                  <TableHead className="text-start">تلفن</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">فرصت‌ها / فعالیت‌ها</TableHead>
                  <TableHead className="text-start">تاریخ ثبت</TableHead>
                  <TableHead className="text-start w-36">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="cursor-pointer hover:bg-accent/50 border-b transition-colors last:border-0"
                    onClick={() => setOpenCustomerId(c.id)}
                  >
                    <TableCell>
                      <p className="font-semibold text-sm">{c.company}</p>
                      <p className="text-xs text-muted-foreground">{c.name}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{[c.industry, c.city].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell dir="ltr" className="text-start text-sm tnum">{c.phone}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="font-normal">{faNum(c._count?.deals)} فرصت</Badge>
                        <Badge variant="secondary" className="font-normal">{faNum(c._count?.activity)} فعالیت</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{faDate(c.createdAt)}</TableCell>
                    <TableCell>{actions(c)}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden space-y-3">
            <AnimatePresence initial={false}>
              {customers.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  variants={fadeItem}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-xl border bg-card p-4 space-y-3 cursor-pointer"
                  onClick={() => setOpenCustomerId(c.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.company}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" aria-hidden />{c.phone}</span>
                    {[c.industry, c.city].filter(Boolean).length > 0 && (
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" aria-hidden />{[c.industry, c.city].filter(Boolean).join("، ")}</span>
                    )}
                    <span>{faDate(c.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="font-normal text-xs">{faNum(c._count?.deals)} فرصت</Badge>
                      <Badge variant="secondary" className="font-normal text-xs">{faNum(c._count?.activity)} فعالیت</Badge>
                    </div>
                    {actions(c)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <CustomerDeleteAlert target={deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)} onDeleted={() => setOpenCustomerId(null)} />
      <CustomerDetailSheet
        onEdit={(c) => openEdit(c)}
        onDelete={(c) => setDeleteTarget(c)}
      />
    </div>
  );
}
