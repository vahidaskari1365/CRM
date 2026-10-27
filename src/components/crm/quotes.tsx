"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Printer, Pencil, Trash2, FileText, Building2, Eye, MoreHorizontal,
  ShoppingCart, BadgeCheck, Clock, CircleDollarSign, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { faNum, faMoney, faMoneyFull, faDate, quoteStatusLabel, quoteStatusColor, QUOTE_STATUS } from "@/lib/format";
import type { CustomerDto, ProductDto, QuoteDto, QuoteItemDto } from "@/lib/types";

// ─── helpers ───
const computeLine = (it: Pick<QuoteItemDto, "quantity" | "unitPrice" | "discount">) =>
  Math.round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) * (1 - (Number(it.discount) || 0) / 100));

interface DraftItem {
  productId?: string | null;
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

const statusBg: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default function QuotesModule() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteDto | null>(null);
  const [viewing, setViewing] = useState<QuoteDto | null>(null);
  const [deleting, setDeleting] = useState<QuoteDto | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: quotes, isLoading } = useQuery<QuoteDto[]>({
    queryKey: ["quotes"],
    queryFn: async () => {
      const r = await fetch("/api/quotes");
      if (!r.ok) throw new Error("خطا در دریافت");
      return r.json();
    },
  });

  const { data: customers } = useQuery<CustomerDto[]>({
    queryKey: ["customers"],
    queryFn: async () => (await fetch("/api/customers")).json(),
  });
  const { data: products } = useQuery<ProductDto[]>({
    queryKey: ["products"],
    queryFn: async () => (await fetch("/api/products")).json(),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      toast.success("وضعیت پیش‌فاکتور به‌روزرسانی شد");
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast.success("پیش‌فاکتور حذف شد");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (quotes ?? []).filter((q) => statusFilter === "all" || q.status === statusFilter),
    [quotes, statusFilter]
  );
  const approvedTotal = useMemo(
    () => (quotes ?? []).filter((q) => q.status === "approved").reduce((s, q) => s + q.total, 0),
    [quotes]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">پیش‌فاکتورها</h1>
          <p className="text-sm text-muted-foreground mt-1">
            صدور و پیگیری پیش‌فاکتورهای فروش با محاسبات خودکار
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="min-h-11 gap-2"
          aria-label="پیش‌فاکتور جدید"
        >
          <Plus className="size-4" /> پیش‌فاکتور جدید
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "کل پیش‌فاکتورها", value: faNum(quotes?.length ?? 0), icon: FileText, tint: "text-primary bg-primary/10" },
          { label: "تأییدشده", value: faNum((quotes ?? []).filter((q) => q.status === "approved").length), icon: BadgeCheck, tint: "text-emerald-600 bg-emerald-500/10" },
          { label: "در انتظار پاسخ", value: faNum((quotes ?? []).filter((q) => q.status === "sent").length), icon: Clock, tint: "text-amber-600 bg-amber-500/10" },
          { label: "ارزش تأییدشده", value: faMoney(approvedTotal), icon: CircleDollarSign, tint: "text-fuchsia-600 bg-fuchsia-500/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/70">
              <CardContent className="p-4 flex items-center gap-3">
                <span className={`size-10 rounded-lg grid place-items-center shrink-0 ${s.tint}`}>
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{s.label}</span>
                  <span className="block font-bold truncate">{s.value}</span>
                </span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" className="min-h-11" onClick={() => setStatusFilter("all")}>
          همه ({faNum(quotes?.length ?? 0)})
        </Button>
        {QUOTE_STATUS.map((s) => (
          <Button key={s.key} variant={statusFilter === s.key ? "default" : "outline"} size="sm" className="min-h-11" onClick={() => setStatusFilter(s.key)}>
            {s.label} ({faNum((quotes ?? []).filter((q) => q.status === s.key).length)})
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border/70">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FileText className="mx-auto size-10 mb-3 opacity-30" />
              پیش‌فاکتوری یافت نشد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead className="hidden md:table-cell">تاریخ صدور</TableHead>
                    <TableHead className="hidden lg:table-cell">اعتبار تا</TableHead>
                    <TableHead className="text-center">اقلام</TableHead>
                    <TableHead>مبلغ کل</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="text-left">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence initial={false}>
                    {filtered.map((q) => (
                      <motion.tr
                        key={q.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b hover:bg-accent/40 cursor-pointer transition-colors"
                        onClick={() => setViewing(q)}
                      >
                        <TableCell className="font-mono text-sm font-semibold" dir="ltr">{q.number}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <Building2 className="size-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{q.customer?.company}</span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{faDate(q.issueDate)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{faDate(q.validUntil)}</TableCell>
                        <TableCell className="text-center">{faNum(q._count?.items ?? (q.items?.length ?? 0))}</TableCell>
                        <TableCell className="font-bold whitespace-nowrap">{faMoney(q.total)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${statusBg[q.status]} border-0`}>
                            {quoteStatusLabel(q.status)}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="size-9" aria-label="مشاهده" onClick={() => setViewing(q)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-9" aria-label="ویرایش" onClick={() => { setEditing(q); setDialogOpen(true); }}>
                              <Pencil className="size-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-9" aria-label="عملیات بیشتر">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {QUOTE_STATUS.filter((s) => s.key !== q.status).map((s) => (
                                  <DropdownMenuItem key={s.key} onClick={() => setStatus.mutate({ id: q.id, status: s.key })}>
                                    تغییر وضعیت به «{s.label}»
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(q)}>
                                  <Trash2 className="size-4 ml-2" /> حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor / View / Delete dialogs */}
      <QuoteEditor
        open={dialogOpen}
        editing={editing}
        customers={customers ?? []}
        products={products ?? []}
        onClose={() => setDialogOpen(false)}
      />
      <QuotePreview quote={viewing} onClose={() => setViewing(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پیش‌فاکتور</AlertDialogTitle>
            <AlertDialogDescription>
              پیش‌فاکتور «{deleting?.number}» برای همیشه حذف خواهد شد. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleting && remove.mutate(deleting.id)}>
              حذف قطعی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────── Editor ───────────────────────────

function QuoteEditor({
  open, editing, customers, products, onClose,
}: {
  open: boolean;
  editing: QuoteDto | null;
  customers: CustomerDto[];
  products: ProductDto[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [formKey, setFormKey] = useState(0);

  // reset on open/editing change via key
  const currentKey = `${open}-${editing?.id ?? "new"}`;
  if (formKey !== 0 && formKey.toString() !== currentKey) { /* noop - key handled below */ }

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
    const afterLines = items.reduce((s, it) => s + computeLine(it), 0);
    const discount = Math.round((afterLines * (Number(discountPercent) || 0)) / 100);
    const tax = Math.round((afterLines - discount) * 0.1);
    const total = afterLines - discount + tax;
    return { subtotal, afterLines, discount, tax, total };
  }, [items, discountPercent]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { customerId, items, discountPercent: Number(discountPercent) || 0, notes, validUntil: validUntil || null, status: editing?.status ?? "draft" };
      const url = editing ? `/api/quotes/${editing.id}` : "/api/quotes";
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      toast.success(editing ? "پیش‌فاکتور ویرایش شد" : "پیش‌فاکتور صادر شد");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addProduct = (pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    setItems((prev) => [...prev, { productId: p.id, name: p.name, unit: p.unit, quantity: 1, unitPrice: p.price, discount: 0 }]);
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  // hydrate when editing
  const [hydratedFor, setHydratedFor] = useState("");
  if (open && editing && hydratedFor !== editing.id) {
    setHydratedFor(editing.id);
    setCustomerId(editing.customerId);
    setItems((editing.items ?? []).map((it) => ({ productId: it.productId, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount })));
    setDiscountPercent(editing.subtotal > 0 ? Math.round((editing.discount / Math.max(1, editing.subtotal - editing.discount)) * 100) : 0);
    setNotes(editing.notes ?? "");
    setValidUntil(editing.validUntil ? editing.validUntil.slice(0, 10) : "");
  }
  if (open && !editing && hydratedFor !== "new") {
    setHydratedFor("new");
    setCustomerId("");
    setItems([]);
    setDiscountPercent(0);
    setNotes("");
    setValidUntil("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" key={currentKey}>
        <DialogHeader>
          <DialogTitle>{editing ? `ویرایش پیش‌فاکتور ${editing.number}` : "صدور پیش‌فاکتور جدید"}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>مشتری *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="min-h-11 w-full"><SelectValue placeholder="انتخاب مشتری…" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>اعتبار تا</Label>
            <Input type="date" dir="ltr" className="min-h-11" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">اقلام پیش‌فاکتور</Label>
            <Select value="" onValueChange={addProduct}>
              <SelectTrigger className="w-56 min-h-11"><SelectValue placeholder="+ افزودن محصول" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({faMoneyFull(p.price)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              <ShoppingCart className="mx-auto size-8 mb-2 opacity-30" />
              از منوی بالا محصول اضافه کنید
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((it, idx) => (
                  <motion.div key={idx} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 md:grid-cols-[1fr_88px_130px_88px_1fr_36px] gap-2 items-end">
                          <div className="col-span-2 md:col-span-1">
                            <Label className="text-[11px] text-muted-foreground">شرح</Label>
                            <Input className="min-h-10 text-sm" value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">تعداد</Label>
                            <Input className="min-h-10 text-sm" dir="ltr" type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">قیمت واحد</Label>
                            <Input className="min-h-10 text-sm" dir="ltr" type="number" value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">تخفیف ٪</Label>
                            <Input className="min-h-10 text-sm" dir="ltr" type="number" min={0} max={100} value={it.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })} />
                          </div>
                          <div className="text-left">
                            <Label className="text-[11px] text-muted-foreground">جمع خط</Label>
                            <div className="min-h-10 flex items-center font-bold text-sm">{faMoneyFull(computeLine(it))}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label="حذف قلم" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                            <X className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Totals + discount + notes */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>تخفیف کلی (٪)</Label>
              <Input className="min-h-11" dir="ltr" type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>یادداشت‌ها</Label>
              <Textarea rows={3} placeholder="شرایط پرداخت، حمل و…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <Card className="bg-accent/40 border-border/60 h-fit">
            <CardContent className="p-4 space-y-2 text-sm">
              <Row label="جمع اقلام" value={faMoneyFull(totals.subtotal)} />
              <Row label="تخفیف اقلام + کلی" value={`− ${faMoneyFull(totals.subtotal - totals.afterLines + totals.discount)}`} />
              <Row label="مالیات ارزش افزوده (۱۰٪)" value={faMoneyFull(totals.tax)} />
              <Separator className="my-1" />
              <div className="flex justify-between items-center">
                <span className="font-semibold">مبلغ نهایی</span>
                <span className="text-lg font-extrabold text-primary">{faMoneyFull(totals.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="min-h-11" onClick={onClose}>انصراف</Button>
          <Button
            className="min-h-11"
            disabled={!customerId || items.length === 0 || save.isPending}
            onClick={() => save.mutate()}
            aria-label="ذخیره پیش‌فاکتور"
          >
            {save.isPending ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "صدور پیش‌فاکتور"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─────────────────────────── Print preview ───────────────────────────

function QuotePreview({ quote: brief, onClose }: { quote: QuoteDto | null; onClose: () => void }) {
  // واکشی نسخه کامل (با اقلام) هنگام باز شدن پیش‌نمایش
  const { data: full } = useQuery<QuoteDto>({
    queryKey: ["quote-detail", brief?.id],
    queryFn: async () => {
      const r = await fetch(`/api/quotes/${brief!.id}`);
      if (!r.ok) throw new Error("خطا در دریافت جزئیات");
      return r.json();
    },
    enabled: !!brief,
  });
  const quote = full ?? brief;
  if (!brief) return null;
  return (
    <Dialog open={!!brief} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle className="flex items-center justify-between">
            <span>پیش‌نمایش و چاپ — {brief.number}</span>
            <Button size="sm" className="min-h-11 gap-2" onClick={() => window.print()} aria-label="چاپ">
              <Printer className="size-4" /> چاپ / ذخیره PDF
            </Button>
          </DialogTitle>
        </DialogHeader>
        {quote ? <QuotePaper quote={quote} /> : <Skeleton className="h-96 w-full" />}
      </DialogContent>
    </Dialog>
  );
}

/** قالب حرفه‌ای چاپ با هویت بصری رودین */
export function QuotePaper({ quote }: { quote: QuoteDto }) {
  const c = quote.customer;
  return (
    <div className="print-area rounded-xl border bg-white text-zinc-900 p-6 md:p-8 space-y-6 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-violet-600/80 pb-4">
        <div className="flex items-center gap-3">
          <span className="size-12 rounded-2xl bg-violet-600 text-white grid place-items-center text-xl font-black">R</span>
          <div>
            <div className="text-xl font-black tracking-tight">رودین</div>
            <div className="text-[11px] text-zinc-500">نرم‌افزار CRM و اتوماسیون سازمانی</div>
          </div>
        </div>
        <div className="text-left">
          <div className="inline-block rounded-lg bg-violet-600/10 text-violet-700 px-3 py-1 text-sm font-bold">پیش‌فاکتور فروش</div>
          <div className="mt-2 text-sm text-zinc-600 font-mono" dir="ltr">{quote.number}</div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-zinc-50 border p-4">
          <div className="text-[11px] text-zinc-500 mb-2">مشتری</div>
          <div className="font-bold">{c?.company}</div>
          <div className="text-zinc-600 mt-1">{c?.name} — {c?.phone}</div>
          {c?.address && <div className="text-zinc-500 text-xs mt-1">{c.address}</div>}
        </div>
        <div className="rounded-lg bg-zinc-50 border p-4 grid grid-cols-2 gap-2 content-start">
          <Meta label="تاریخ صدور" value={faDate(quote.issueDate)} />
          <Meta label="اعتبار تا" value={faDate(quote.validUntil)} />
          <Meta label="وضعیت" value={quoteStatusLabel(quote.status)} />
          <Meta label="تعداد اقلام" value={faNum(quote.items?.length ?? 0)} />
        </div>
      </div>

      {/* Items */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-violet-600/10 text-violet-800">
            <th className="border p-2 text-right font-semibold rounded-tr-lg">#</th>
            <th className="border p-2 text-right font-semibold">شرح کالا / خدمات</th>
            <th className="border p-2 text-center font-semibold">تعداد</th>
            <th className="border p-2 text-center font-semibold">قیمت واحد</th>
            <th className="border p-2 text-center font-semibold">تخفیف</th>
            <th className="border p-2 text-center font-semibold rounded-tl-lg">جمع (تومان)</th>
          </tr>
        </thead>
        <tbody>
          {(quote.items ?? []).map((it, i) => (
            <tr key={it.id ?? i} className="even:bg-zinc-50">
              <td className="border p-2 text-center">{faNum(i + 1)}</td>
              <td className="border p-2">{it.name}</td>
              <td className="border p-2 text-center">{faNum(it.quantity)}</td>
              <td className="border p-2 text-center tnum" dir="ltr">{faNum(it.unitPrice)}</td>
              <td className="border p-2 text-center">{faNum(it.discount)}٪</td>
              <td className="border p-2 text-center font-semibold tnum" dir="ltr">{faNum(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-start">
        <div className="w-full md:w-80 space-y-1.5 text-sm">
          <PT label="جمع کل اقلام" value={faMoneyFull(quote.subtotal)} />
          <PT label="تخفیف" value={`− ${faMoneyFull(quote.discount)}`} />
          <PT label="مالیات بر ارزش افزوده (۱۰٪)" value={faMoneyFull(quote.tax)} />
          <div className="flex justify-between items-center rounded-lg bg-violet-600 text-white px-3 py-2 font-bold">
            <span>مبلغ قابل پرداخت</span>
            <span>{faMoneyFull(quote.total)}</span>
          </div>
        </div>
      </div>

      {quote.notes && (
        <div className="text-xs text-zinc-600 border-t pt-3 leading-6">
          <span className="font-semibold text-zinc-800">یادداشت: </span>{quote.notes}
        </div>
      )}

      {/* Footer */}
      <div className="grid grid-cols-2 gap-6 pt-4 text-xs text-zinc-500">
        <div className="border-t border-dashed pt-2 text-center">مهر و امضای فروشنده</div>
        <div className="border-t border-dashed pt-2 text-center">مهر و امضای خریدار</div>
      </div>
      <div className="text-center text-[10px] text-zinc-400 pt-2">
        صادرشده توسط سامانه رودین CRM — {faDate(new Date())}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="font-semibold text-zinc-800">{value}</div>
    </div>
  );
}

function PT({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-zinc-700">
      <span>{label}</span>
      <span className="font-medium tnum">{value}</span>
    </div>
  );
}
