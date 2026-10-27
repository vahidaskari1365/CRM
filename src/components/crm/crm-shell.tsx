"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Handshake, ListTodo, FileText, BarChart3,
  Workflow, Settings, Search, Sun, Moon, Menu, PanelRightClose,
  PanelRightOpen, Palette, Building2, Target, CheckSquare, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ACCENTS, useCrmStore, type AccentKey, type Section } from "@/lib/crm-store";
import { faNum, faMoney } from "@/lib/format";

const NAV: { key: Section; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard, hint: "نمای کلی و تحلیل" },
  { key: "customers", label: "مشتریان", icon: Users, hint: "اطلاعات تماس و سوابق" },
  { key: "deals", label: "فرصت‌های فروش", icon: Handshake, hint: "پیپلاین و مذاکرات" },
  { key: "tasks", label: "وظایف و پیگیری", icon: ListTodo, hint: "یادآوری‌ها" },
  { key: "quotes", label: "پیش‌فاکتور", icon: FileText, hint: "صدور و چاپ" },
  { key: "reports", label: "گزارش‌ساز", icon: BarChart3, hint: "نمودارهای دلخواه" },
  { key: "workflows", label: "فرآیندساز", icon: Workflow, hint: "اتوماسیون n8n-like" },
  { key: "settings", label: "تنظیمات", icon: Settings, hint: "تم و کاربران" },
];

const SECTION_TITLES: Record<Section, string> = {
  dashboard: "داشبورد مدیریت",
  customers: "مشتریان",
  deals: "فرصت‌های فروش",
  tasks: "وظایف و پیگیری‌ها",
  quotes: "پیش‌فاکتورها",
  reports: "گزارش‌ساز گرافیکی",
  workflows: "فرآیندساز اتوماسیون",
  settings: "تنظیمات",
};

export default function CrmShell() {
  const section = useCrmStore((s) => s.section);
  const setSection = useCrmStore((s) => s.setSection);
  const collapsed = useCrmStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useCrmStore((s) => s.toggleCollapsed);
  const sidebarOpen = useCrmStore((s) => s.sidebarOpen);
  const setSidebarOpen = useCrmStore((s) => s.setSidebarOpen);

  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const sidebar = (
    <SidebarContent collapsed={collapsed} active={section} onSelect={setSection} onToggle={toggleCollapsed} />
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md no-print">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="lg:hidden size-11" aria-label="منو" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </Button>

          {/* Logo (mobile + desktop collapsed) */}
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-black shadow-sm">R</span>
            <div className="hidden sm:block leading-tight">
              <div className="font-extrabold tracking-tight">رودین <span className="text-primary">CRM</span></div>
              <div className="text-[10px] text-muted-foreground">CRM و اتوماسیون سازمانی</div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden lg:block h-7" />

          <h2 className="hidden lg:block text-sm font-medium text-muted-foreground">{SECTION_TITLES[section]}</h2>

          <div className="flex-1" />

          {/* Global search */}
          <GlobalSearch />

          {/* Accent quick pick */}
          <Popover>
            <PopoverTrigger asChild>
              <Button suppressHydrationWarning variant="ghost" size="icon" className="size-11" aria-label="تغییر رنگ محیط">
                <Palette className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="text-sm font-semibold mb-2">رنگ‌بندی محیط کار</div>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(ACCENTS) as [AccentKey, (typeof ACCENTS)[AccentKey]][]).map(([k, c]) => (
                  <button
                    key={k}
                    onClick={() => { useCrmStore.getState().setAccent(k); toast.success(`رنگ ${c.label} اعمال شد`); }}
                    className="size-11 rounded-xl hover:scale-105 transition-transform"
                    style={{ background: c.hex }}
                    aria-label={c.label}
                    title={c.label}
                  />
                ))}
              </div>
              <Button variant="link" size="sm" className="mt-2 h-8 px-0" onClick={() => setSection("settings")}>
                تنظیمات بیشتر…
              </Button>
            </PopoverContent>
          </Popover>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="تغییر تم روشن/تاریک"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {mounted && resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          {/* User chip */}
          <button
            className="flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 hover:bg-accent transition-colors min-h-11"
            onClick={() => setSection("settings")}
            aria-label="پروفایل کاربر"
          >
            <span className="size-8 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white grid place-items-center text-sm font-bold">س</span>
            <span className="hidden md:block text-sm font-medium">سارا محمدی</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block sticky top-16 h-[calc(100vh-4rem)] shrink-0 border-l no-print transition-all duration-300" style={{ width: collapsed ? 76 : 264 }}>
          {sidebar}
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="right" className="p-0 w-[280px]">
            <SheetHeader className="sr-only">
              <SheetTitle>منوی اصلی</SheetTitle>
            </SheetHeader>
            <SidebarContent collapsed={false} active={section} onSelect={setSection} onToggle={null} />
          </SheetContent>
        </Sheet>

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 lg:px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="max-w-[1400px] mx-auto"
            >
              {section === "dashboard" && <DashboardLazy />}
              {section === "customers" && <CustomersLazy />}
              {section === "deals" && <DealsLazy />}
              {section === "tasks" && <TasksLazy />}
              {section === "quotes" && <QuotesLazy />}
              {section === "reports" && <ReportsLazy />}
              {section === "workflows" && <WorkflowsLazy />}
              {section === "settings" && <SettingsLazy />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-background/80 backdrop-blur-sm no-print">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            © رودین CRM — نرم‌افزار مدیریت ارتباط با مشتری و اتوماسیون سازمانی
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            نسخه ۱٫۰ · ساخته‌شده برای تیم‌های فروش مدرن
          </span>
        </div>
      </footer>
    </div>
  );
}

// الگوی تشخیص mount بدون setState در effect (سازگار با hydration)
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

// ─── Sidebar ───
function SidebarContent({
  collapsed, active, onSelect, onToggle,
}: {
  collapsed: boolean;
  active: Section;
  onSelect: (s: Section) => void;
  onToggle: (() => void) | null;
}) {
  return (
    <div className="flex flex-col h-full">
      {collapsed === false && onToggle === null ? null : (
        <div className="h-4" />
      )}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav aria-label="ناوبری اصلی" className="space-y-1">
          {NAV.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`relative w-full flex items-center gap-3 rounded-xl px-3 min-h-11 text-sm transition-colors ${
                  isActive ? "text-primary-foreground" : "text-foreground/80 hover:bg-accent hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon className={`relative size-[18px] shrink-0 ${isActive ? "" : "text-muted-foreground"}`} />
                {!collapsed && (
                  <span className="relative flex-1 text-right leading-tight">
                    <span className="block font-medium">{item.label}</span>
                    <span className={`block text-[10px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.hint}</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="mt-6 mx-1 rounded-2xl border bg-gradient-to-br from-primary/10 via-transparent to-fuchsia-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> فرآیندساز هوشمند
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-5">
              اتوماسیون‌های خود را مثل n8n بسازید و با داده واقعی تست بگیرید.
            </p>
            <Button size="sm" className="mt-3 w-full min-h-9" onClick={() => onSelect("workflows")}>
              شروع ساختن
            </Button>
          </div>
        )}
      </ScrollArea>

      {onToggle && (
        <div className="border-t p-3">
          <Button variant="ghost" className="w-full min-h-11 justify-start gap-3" onClick={onToggle} aria-label="جمع کردن منو">
            {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
            {!collapsed && <span className="text-sm">جمع کردن منو</span>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Global search ───
interface SearchResults {
  customers: { id: string; company: string; name: string; phone: string }[];
  deals: { id: string; title: string; value: number; stage: string; customer?: { company: string } }[];
  tasks: { id: string; title: string; status: string; customer?: { company: string } }[];
  quotes: { id: string; number: string; total: number; status: string; customer?: { company: string } }[];
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useCrmStore((s) => s.navigate);

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["search", q],
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      return r.json();
    },
    enabled: open && q.trim().length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasResults =
    (data?.customers.length ?? 0) + (data?.deals.length ?? 0) + (data?.tasks.length ?? 0) + (data?.quotes.length ?? 0) > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          suppressHydrationWarning
          className="flex items-center gap-2 rounded-xl border bg-muted/50 px-3 min-h-11 text-sm text-muted-foreground hover:bg-accent transition-colors w-10 sm:w-56 md:w-72"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          aria-label="جستجوی سراسری"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden sm:inline flex-1 text-right">جستجو در همه‌چیز…</span>
          <kbd className="hidden md:inline-flex items-center rounded border bg-background px-1.5 text-[10px] tnum" dir="ltr">Ctrl K</kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] sm:w-[420px] p-0">
        <div className="p-3 border-b">
          <Input
            ref={inputRef}
            placeholder="نام مشتری، فرصت، وظیفه، شماره پیش‌فاکتور…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11"
            aria-label="عبارت جستجو"
          />
        </div>
        <ScrollArea className="max-h-[380px]">
          <div className="p-2">
            {q.trim().length < 2 ? (
              <p className="text-center text-sm text-muted-foreground py-8">حداقل ۲ حرف بنویسید (Ctrl+K)</p>
            ) : isFetching && !data ? (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="size-4 animate-spin" /> در حال جستجو…
              </p>
            ) : !hasResults ? (
              <p className="text-center text-sm text-muted-foreground py-8">نتیجه‌ای یافت نشد</p>
            ) : (
              <div className="space-y-3">
                {(data?.customers.length ?? 0) > 0 && (
                  <SearchGroup title="مشتریان" icon={Building2}>
                    {data!.customers.map((c) => (
                      <button key={c.id} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent text-right" onClick={() => { setOpen(false); navigate("customers", { customerId: c.id }); }}>
                        <Building2 className="size-4 text-primary shrink-0" />
                        <span className="font-medium flex-1 truncate">{c.company}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{c.phone}</span>
                      </button>
                    ))}
                  </SearchGroup>
                )}
                {(data?.deals.length ?? 0) > 0 && (
                  <SearchGroup title="فرصت‌های فروش" icon={Target}>
                    {data!.deals.map((d) => (
                      <button key={d.id} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent text-right" onClick={() => { setOpen(false); navigate("deals"); }}>
                        <Target className="size-4 text-amber-500 shrink-0" />
                        <span className="flex-1 truncate">{d.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{faMoney(d.value)}</Badge>
                      </button>
                    ))}
                  </SearchGroup>
                )}
                {(data?.tasks.length ?? 0) > 0 && (
                  <SearchGroup title="وظایف" icon={CheckSquare}>
                    {data!.tasks.map((t) => (
                      <button key={t.id} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent text-right" onClick={() => { setOpen(false); navigate("tasks"); }}>
                        <CheckSquare className="size-4 text-emerald-500 shrink-0" />
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.customer && <span className="text-xs text-muted-foreground truncate max-w-24">{t.customer.company}</span>}
                      </button>
                    ))}
                  </SearchGroup>
                )}
                {(data?.quotes.length ?? 0) > 0 && (
                  <SearchGroup title="پیش‌فاکتورها" icon={FileText}>
                    {data!.quotes.map((qt) => (
                      <button key={qt.id} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent text-right" onClick={() => { setOpen(false); navigate("quotes"); }}>
                        <FileText className="size-4 text-fuchsia-500 shrink-0" />
                        <span className="font-mono" dir="ltr">{qt.number}</span>
                        <span className="flex-1 text-right text-xs text-muted-foreground truncate">{qt.customer?.company}</span>
                        <Badge variant="secondary" className="text-[10px]">{faMoney(qt.total)}</Badge>
                      </button>
                    ))}
                  </SearchGroup>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          جستجوی سریع در {faNum(4)} نوع موجودیت — مشتریان، فرصت‌ها، وظایف و پیش‌فاکتورها
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SearchGroup({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Section lazy wrappers (named chunks, no dynamic import issues) ───
import DashboardModule from "@/components/crm/dashboard";
import CustomersModule from "@/components/crm/customers";
import DealsModule from "@/components/crm/deals";
import TasksModule from "@/components/crm/tasks";
import QuotesModule from "@/components/crm/quotes";
import ReportBuilderModule from "@/components/crm/report-builder";
import WorkflowsModule from "@/components/crm/workflows";
import SettingsModule from "@/components/crm/settings";

function DashboardLazy() { return <DashboardModule />; }
function CustomersLazy() { return <CustomersModule />; }
function DealsLazy() { return <DealsModule />; }
function TasksLazy() { return <TasksModule />; }
function QuotesLazy() { return <QuotesModule />; }
function ReportsLazy() { return <ReportBuilderModule />; }
function WorkflowsLazy() { return <WorkflowsModule />; }
function SettingsLazy() { return <SettingsModule />; }
