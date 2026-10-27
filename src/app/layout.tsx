import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/crm/providers";

export const metadata: Metadata = {
  title: "رودین CRM | نرم‌افزار CRM و اتوماسیون سازمانی",
  description:
    "سامانه یکپارچه مدیریت ارتباط با مشتریان، فرصت‌های فروش، پیش‌فاکتور، گزارش‌ساز گرافیکی و فرآیندساز خودکار رودین",
  keywords: ["CRM", "رودین", "اتوماسیون سازمانی", "مدیریت فروش", "پیش‌فاکتور", "فرآیندساز"],
  authors: [{ name: "Roudin Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#16151d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <Providers>
          {children}
          <Toaster position="bottom-left" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
