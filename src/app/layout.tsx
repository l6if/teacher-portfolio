import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["arabic"],
  weight: ["200", "300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ملف إنجاز المعلم",
  description:
    "منصة احترافية لبناء ملف إنجاز المعلم تدريجيًا طوال العام، وتوثيق العمل والنتائج والأثر المهني، وتحويلها إلى تقارير أنيقة قابلة للطباعة.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e7f6e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${readex.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-left" richColors closeButton dir="rtl" />
      </body>
    </html>
  );
}
