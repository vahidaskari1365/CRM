"use client";

import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Sun, Moon, Monitor, Palette, Users, ShieldCheck, Puzzle, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ACCENTS, useCrmStore, type AccentKey } from "@/lib/crm-store";
import { faNum, faDate } from "@/lib/format";
import type { UserDto } from "@/lib/types";

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  admin: { label: "مدیر سیستم", cls: "bg-primary/15 text-primary" },
  manager: { label: "مدیر فروش", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  sales: { label: "کارشناس فروش", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

const ROLE_PERMS: Record<string, string> = {
  admin: "دسترسی کامل به همه بخش‌ها، تنظیمات، فرآیندها و مدیریت کاربران",
  manager: "مشاهده همه گزارش‌ها و داشبورد، مدیریت فرصت‌ها و پیش‌فاکتورهای تیم",
  sales: "مدیریت مشتریان، فرصت‌ها، وظایف و پیش‌فاکتورهای خود",
};

export default function SettingsModule() {
  const { theme, setTheme } = useTheme();
  const accent = useCrmStore((s) => s.accent);
  const setAccent = useCrmStore((s) => s.setAccent);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const { data: users, isLoading } = useQuery<UserDto[]>({
    queryKey: ["users"],
    queryFn: async () => (await fetch("/api/users")).json(),
  });

  const themeOptions = [
    { key: "light", label: "روشن", icon: Sun, desc: "محیط روشن و مینیمال" },
    { key: "dark", label: "تاریک", icon: Moon, desc: "راحت برای چشم در شب" },
    { key: "system", label: "سیستم", icon: Monitor, desc: "هماهنگ با دستگاه شما" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">تنظیمات</h1>
        <p className="text-sm text-muted-foreground mt-1">شخصی‌سازی محیط کار، تم و مدیریت کاربران</p>
      </div>

      {/* Theme */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">حالت نمایش</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            {themeOptions.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTheme(t.key); toast.success(`تم ${t.label} فعال شد`); }}
                className={`min-h-24 rounded-xl border-2 p-4 text-right transition-all hover:-translate-y-0.5 ${
                  mounted && theme === t.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
                aria-label={`تم ${t.label}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <t.icon className="size-5 text-primary" /> {t.label}
                  {mounted && theme === t.key && <Check className="size-4 text-primary mr-auto" />}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">{t.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accent */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="size-4 text-primary" /> رنگ‌بندی محیط کار
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">رنگ تأکیدی دلخواه خود را انتخاب کنید — بلافاصله روی کل نرم‌افزار اعمال می‌شود.</p>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(ACCENTS) as [AccentKey, (typeof ACCENTS)[AccentKey]][]).map(([key, conf]) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setAccent(key); toast.success(`رنگ ${conf.label} اعمال شد`); }}
                className={`size-14 rounded-2xl grid place-items-center relative transition-all ${
                  accent === key ? "ring-2 ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ background: conf.hex, ...(accent === key ? { boxShadow: `0 0 0 2px ${conf.hex}` } : {}) }}
                aria-label={`رنگ ${conf.label}`}
                title={conf.label}
              >
                {accent === key && <Check className="size-5 text-white" />}
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users & roles */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4 text-primary" /> کاربران، نقش‌ها و سطوح دسترسی
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {(users ?? []).map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4 hover:bg-accent/40 transition-colors">
                  <span
                    className="size-11 rounded-full grid place-items-center text-white font-bold shrink-0"
                    style={{ background: u.color }}
                    aria-hidden
                  >
                    {u.name.trim()[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{u.name}</span>
                      <Badge variant="secondary" className={`${ROLE_LABELS[u.role]?.cls ?? ""} border-0`}>
                        <ShieldCheck className="size-3 ml-1" /> {ROLE_LABELS[u.role]?.label ?? u.role}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.email} {u.phone ? `— ${u.phone}` : ""}</div>
                    <div className="text-xs text-muted-foreground mt-1">{ROLE_PERMS[u.role]}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">عضویت: {faDate(u.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
          <Separator className="my-4" />
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            {Object.entries(ROLE_PERMS).map(([role, perm]) => (
              <div key={role} className="rounded-lg bg-muted/60 p-3">
                <div className="font-semibold text-foreground mb-1">{ROLE_LABELS[role]?.label}</div>
                <div className="text-muted-foreground leading-5">{perm}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Puzzle className="size-4 text-primary" /> درباره رودین CRM
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-muted-foreground leading-7">
            سامانه یکپارچه CRM و اتوماسیون سازمانی رودین، نسخه {faNum(1)}.{faNum(0)} — شامل مدیریت مشتریان،
            فرصت‌های فروش، وظایف و یادآوری‌ها، پیش‌فاکتور حرفه‌ای، گزارش‌ساز گرافیکی، فرآیندساز خودکار
            (مشابه n8n) با تست واقعی فرآیند، تحلیل هوش مصنوعی و تم تاریک/روشن با رنگ‌بندی شخصی.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {[
              "معماری ماژولار و قابل توسعه — افزودن اتوماسیون واحدهای جدید در آینده",
              "موتور فرآیند واقعی: ساخت وظیفه/فعالیت، شرط‌گذاری با داده تستی",
              "گزارش‌ساز: ۵ نوع نمودار + جدول + خروجی CSV و چاپ",
              "دستیار تحلیل هوشمند مبتنی بر داده‌های زنده سیستم",
            ].map((f) => (
              <div key={f} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 leading-5">
                <Check className="size-3.5 mt-0.5 text-emerald-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
