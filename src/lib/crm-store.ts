"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Section =
  | "dashboard"
  | "customers"
  | "deals"
  | "tasks"
  | "quotes"
  | "reports"
  | "workflows"
  | "settings";

export type AccentKey =
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "teal"
  | "orange"
  | "pink"
  | "cyan";

export const ACCENTS: Record<AccentKey, { label: string; oklch: string; oklchDark: string; hex: string }> = {
  violet: { label: "بنفش", oklch: "oklch(0.606 0.22 295)", oklchDark: "oklch(0.68 0.2 295)", hex: "#8b5cf6" },
  emerald: { label: "زمرد", oklch: "oklch(0.62 0.14 165)", oklchDark: "oklch(0.7 0.15 165)", hex: "#10b981" },
  amber: { label: "کهربایی", oklch: "oklch(0.72 0.15 75)", oklchDark: "oklch(0.78 0.15 75)", hex: "#f59e0b" },
  rose: { label: "گلگون", oklch: "oklch(0.62 0.21 5)", oklchDark: "oklch(0.7 0.19 5)", hex: "#f43f5e" },
  teal: { label: "فیروزه‌ای", oklch: "oklch(0.63 0.12 195)", oklchDark: "oklch(0.72 0.12 195)", hex: "#14b8a6" },
  orange: { label: "نارنجی", oklch: "oklch(0.66 0.19 45)", oklchDark: "oklch(0.72 0.18 45)", hex: "#f97316" },
  pink: { label: "صورتی", oklch: "oklch(0.63 0.22 340)", oklchDark: "oklch(0.7 0.2 340)", hex: "#ec4899" },
  cyan: { label: "فیروزه", oklch: "oklch(0.63 0.13 215)", oklchDark: "oklch(0.72 0.13 215)", hex: "#06b6d4" },
};

interface CrmState {
  section: Section;
  setSection: (s: Section) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  toggleCollapsed: () => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  /** برای بازکردن شیت مشتری از هر جای برنامه */
  openCustomerId: string | null;
  setOpenCustomerId: (id: string | null) => void;
  /** پیش‌فرض بخش ساخت فرصت جدید */
  navigate: (s: Section, payload?: { customerId?: string | null }) => void;
}

export const useCrmStore = create<CrmState>()(
  persist(
    (set) => ({
      section: "dashboard",
      setSection: (section) => set({ section, sidebarOpen: false }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      sidebarCollapsed: false,
      toggleCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      accent: "violet",
      setAccent: (accent) => set({ accent }),
      openCustomerId: null,
      setOpenCustomerId: (openCustomerId) => set({ openCustomerId }),
      navigate: (section, payload) =>
        set({ section, sidebarOpen: false, openCustomerId: payload?.customerId ?? null }),
    }),
    {
      name: "roudin-crm-ui",
      partialize: (s) => ({ accent: s.accent, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
