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
  // الأيقونة: أصول محلية بهوية التطبيق (app/icon.svg + app/favicon.ico + app/apple-icon.png)
  // قبعة التخرج البيضاء على أخضر العلامة — لا أيقونات إطار عمل أو استضافة.
};

export const viewport: Viewport = {
  themeColor: "#0e7f6e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // يبقي أزرار الحفظ الثابتة مرئية فوق لوحة المفاتيح على الجوال
  interactiveWidget: "resizes-content",
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
