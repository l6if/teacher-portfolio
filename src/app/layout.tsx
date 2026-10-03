import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// خط الواجهة: IBM Plex Sans Arabic — حديث، واضح، ويدعم اللاتينية بتناغم عالمي
const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// خط العناوين: نسخ تحريري فاخر
const naskh = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ملف إنجاز المعلم",
  description:
    "منصة احترافية لبناء ملف إنجاز المعلم تدريجيًا طوال العام، وتوثيق العمل والنتائج والأثر المهني، وتحويلها إلى تقارير أنيقة قابلة للطباعة.",
  // الأيقونة: أصول محلية بهوية التطبيق (app/icon.svg + app/favicon.ico + app/apple-icon.png)
  // قبعة التخرج الذهبية على كحلي العلامة — لا أيقونات إطار عمل أو استضافة.
};

export const viewport: Viewport = {
  themeColor: "#1B2A41",
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
        className={`${plex.variable} ${naskh.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-left" richColors closeButton dir="rtl" />
      </body>
    </html>
  );
}
