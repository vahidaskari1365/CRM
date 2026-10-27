"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCrmStore, ACCENTS, type AccentKey } from "@/lib/crm-store";

/** اعمال رنگ تأکیدی انتخابی روی CSS variables */
function useAccentSync() {
  const accent = useCrmStore((s) => s.accent);
  useEffect(() => {
    const conf = ACCENTS[accent as AccentKey] ?? ACCENTS.violet;
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const set = (name: string, value: string) => root.style.setProperty(name, value);
    set("--primary", isDark ? conf.oklchDark : conf.oklch);
    set("--primary-foreground", isDark ? "oklch(0.16 0.02 295)" : "oklch(0.985 0 0)");
    set("--ring", isDark ? conf.oklchDark : conf.oklch);
    set("--chart-1", conf.oklchDark);
    set("--sidebar-primary", isDark ? conf.oklchDark : conf.oklch);
    set("--sidebar-ring", isDark ? conf.oklchDark : conf.oklch);
    set("--accent", isDark ? "oklch(0.3 0.05 295)" : "oklch(0.955 0.02 295)");
  }, [accent]);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );
  useAccentSync();
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
