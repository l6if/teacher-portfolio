'use client'

import { useState } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { SECTIONS } from '@/lib/constants'
import { Icon } from '@/components/shared/icon'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/states'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface ReportDef {
  key: 'full' | 'summary' | 'impact' | 'pd' | 'initiatives' | 'custom'
  title: string
  desc: string
  icon: string
  pages: string
  accent: string
}

const REPORTS: ReportDef[] = [
  {
    key: 'full', title: 'تقرير ملف الإنجاز الكامل', icon: 'BookOpen', pages: 'متعدد الصفحات',
    desc: 'غلاف فاخر، فهرس تلقائي، صفحة عنوان لكل مجال، وكل إنجاز بتفاصيله وشواهده — التقرير الرسمي لملفك.',
    accent: 'from-emerald-600 to-teal-700',
  },
  {
    key: 'summary', title: 'تقرير ملخص الإنجازات', icon: 'ClipboardList', pages: 'صفحة أو صفحتان',
    desc: 'لمحة سريعة: عدد الإنجازات، المبادرات، ساعات التطوير، متوسط التحسن، وأبرز الإنجازات.',
    accent: 'from-teal-600 to-cyan-700',
  },
  {
    key: 'impact', title: 'تقرير الأثر المهني', icon: 'TrendingUp', pages: 'صفحة أو صفحتان',
    desc: 'أثرك مقيسًا: الوضع قبل، الإجراء، الوضع بعد، ونسبة التحسن — برسوم بسيطة وواضحة.',
    accent: 'from-emerald-600 to-lime-700',
  },
  {
    key: 'pd', title: 'تقرير التطوير المهني', icon: 'GraduationCap', pages: 'صفحة واحدة غالبًا',
    desc: 'كل برامجك التدريبية مع الجهات والساعات، وإجمالي ساعات التطوير المهني وأثرها.',
    accent: 'from-teal-600 to-emerald-700',
  },
  {
    key: 'initiatives', title: 'تقرير المبادرات', icon: 'Rocket', pages: 'صفحة أو صفحتان',
    desc: 'ملخص كل مبادراتك مع عدد المستفيدين والنتائج والأثر.',
    accent: 'from-emerald-700 to-teal-600',
  },
  {
    key: 'custom', title: 'تصدير مخصص', icon: 'Layers', pages: 'حسب اختيارك',
    desc: 'حدد المجالات التي تريدها فقط، وأنشئ تقريرًا يلبي حاجة محددة — مثل عرض مشرف أو لجنة.',
    accent: 'from-slate-600 to-emerald-700',
  },
]

export function ReportsView() {
  const setPrintConfig = useApp((s) => s.setPrintConfig)
  const { data, isLoading, error, refetch } = useReport()
  const [selected, setSelected] = useState<string[]>([])

  if (isLoading) return <LoadingState rows={2} />
  if (error || !data) return <ErrorState message="تعذر تحميل بيانات التقارير." onRetry={() => refetch()} />

  const { completion, year, user } = data
  const counts = completion.counts
  const hasData = counts.achievements > 0

  const generate = (mode: ReportDef['key'], sections: string[] = []) => {
    if (!hasData) {
      toast.info('أضف إنجازًا واحدًا على الأقل حتى يستحق التقرير الطباعة')
      return
    }
    const def = REPORTS.find((r) => r.key === mode)!
    if (mode === 'custom' && sections.length === 0) {
      toast.error('اختر مجالًا واحدًا على الأقل للتصدير المخصص')
      return
    }
    setPrintConfig({ mode, sections, title: def.title })
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'التقارير' }]}
        title="التقارير الاحترافية"
        description={`حوّل ملف إنجازك في ${year.label} إلى تقارير أنيقة جاهزة للطباعة والمشاركة — بدون قطع سيئ للنصوص.`}
        icon="FileText"
      />

      {/* ملخص أعلى التقارير */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-3xl border border-border bg-card p-3 anim-fade-up sm:grid-cols-5 sm:gap-2.5 sm:p-5">
        {[
          { label: 'إنجازًا', value: counts.achievements },
          { label: 'مبادرات', value: counts.initiatives },
          { label: 'ساعة تطوير', value: counts.pdHours },
          { label: 'خطط علاجية', value: counts.remedial },
          { label: 'شاهدًا', value: counts.evidence },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{formatNumber(s.value)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {!hasData && (
        <div className="mb-6">
          <EmptyState
            icon="FileText"
            title="ملفك يحتاج إنجازًا واحدًا على الأقل"
            description="التقارير تُبنى من محتوى حقيقي — أضف أول إنجاز وسيعكس التقرير عملك بأمانة ودقة."
          />
        </div>
      )}

      {/* بطاقات التقارير */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r, i) => (
          <div key={r.key} className={`group anim-fade-up anim-delay-${Math.min(i + 1, 4)} flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift`}>
            <div className={`bg-gradient-to-l ${r.accent} p-4 text-white sm:p-5`}>
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur sm:size-11">
                  <Icon name={r.icon} className="size-5 sm:size-5.5" strokeWidth={1.8} />
                </div>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium backdrop-blur">{r.pages}</span>
              </div>
              <h3 className="mt-3.5 text-base font-bold sm:mt-4">{r.title}</h3>
            </div>
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <p className="flex-1 text-[13px] leading-6 text-muted-foreground">{r.desc}</p>

              {r.key === 'custom' && (
                <div className="mt-4 space-y-2 rounded-2xl border border-border bg-muted/30 p-3.5">
                  <p className="text-xs font-medium text-foreground">حدد المجالات المطلوبة:</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {SECTIONS.filter((s) => s.content).map((s) => {
                      const checked = selected.includes(s.key)
                      return (
                        <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/60">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => setSelected((sel) => (v ? [...sel, s.key] : sel.filter((k) => k !== s.key)))}
                            aria-label={s.title}
                          />
                          <span className="truncate">{s.title}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <Button
                onClick={() => generate(r.key, selected)}
                disabled={!hasData}
                className="mt-4 min-h-11 w-full gap-2 rounded-full shadow-soft"
                variant={r.key === 'full' ? 'default' : 'outline'}
              >
                <Icon name="Printer" className="size-4" />
                {r.key === 'custom' ? 'إنشاء التقرير' : 'إنشاء PDF'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* تلميح الطباعة */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-xs leading-6 text-secondary-foreground anim-fade-up">
        <Icon name="Info" className="mt-0.5 size-4 shrink-0" />
        <p>
          عند الضغط على «تصدير PDF» يفتح حوار الطباعة — اختر «حفظ بصيغة PDF» وجهّز الطابعة أو الحفظ.
          التصميم مهيأ تلقائيًا لمقاس A4 مع هوامش مريحة ورأس وتذييل احترافيين، ولن تُقطع البطاقات والجداول بين الصفحات.
        </p>
      </div>
    </div>
  )
}
