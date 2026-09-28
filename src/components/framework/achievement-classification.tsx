'use client'

// ═══ تصنيف الإنجاز داخل الإطار المهني — محدد ثلاثي المستويات ═════════
// القسم 13: تعبئة تلقائية عند «إضافة إنجاز لهذا المعيار».
// القسم 39: شارة «يحتاج تصنيفًا» + دعوة «تحديد المعيار» عند غياب التصنيف.
// القسم 43: المصطلحات الرسمية (مجال / معيار / معيار فرعي).

import { useState } from 'react'
import { Icon } from '@/components/shared/icon'
import { useFramework } from '@/hooks/use-data'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FrameworkBadge } from './framework-badges'
import type { TDomainNode } from '@/lib/types'

export function AchievementClassification({
  value, onChange, viewMode, presetLabel,
}: {
  value: string | null
  onChange: (subCriterionId: string | null) => void
  viewMode: boolean
  presetLabel?: { domainName?: string; criterionName?: string; subName?: string } | null
}) {
  const { data } = useFramework()
  const domains = data?.domains ?? []

  // مواضع القيم الحالية في الشجرة — اشتقاق مباشر (شجرة صغيرة ~45 عقدة،
  // أسرع من memo وأبسط من إرضاء مترجم React — نفس نهج المشاريع السابقة)
  const current = (() => {
    for (const d of domains) {
      for (const c of d.criteria) {
        const sub = c.subs.find((s) => s.id === value)
        if (sub) return { domain: d, criterion: c, sub }
      }
    }
    return null
  })()

  // اختيار يدوي لمحاور وسيطة (مجال/معيار) — null يعني «اتبع التصنيف المحفوظ».
  // المكوّن يُعاد تركيبه (key) عند تبديل الإنجاز فتبدأ الحالة نظيفة.
  const [manualDomain, setManualDomain] = useState<string | null>(null)
  const [manualCriterion, setManualCriterion] = useState<string | null>(null)

  const syncedDomain = manualDomain ?? current?.domain.id ?? ''
  const syncedCriterion = manualCriterion ?? current?.criterion.id ?? ''
  const selectedDomain = domains.find((d) => d.id === syncedDomain) ?? null
  const selectedCriterion = selectedDomain?.criteria.find((c) => c.id === syncedCriterion) ?? null

  const setDomain = (id: string) => {
    setManualDomain(id || null)
    setManualCriterion(null)
    onChange(null) // تغيير المجال يلغي الاختيار الأدنى حتى يختار المستخدم من جديد
  }
  const setCriterion = (id: string) => {
    setManualCriterion(id || null)
    onChange(null)
  }

  const activeDomains = domains.filter((d) => !d.archived)

  if (viewMode) {
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Icon name="ScrollText" className="size-4 text-primary" />
          التصنيف على الإطار المهني
        </label>
        {current ? (
          <div className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
            <p className="text-xs leading-6 text-muted-foreground">
              {current.domain.name} ← {current.criterion.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-foreground">{current.sub.name}</p>
              <FrameworkBadge isOfficial={current.sub.isOfficial} />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-3 text-xs text-amber-800">
            يحتاج تصنيفًا — لم يُحدد له معيار فرعي بعد
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Icon name="ScrollText" className="size-4 text-primary" />
          التصنيف على الإطار المهني
        </label>
        {!value && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/70">
            <Icon name="ClipboardList" className="size-3" strokeWidth={2.2} />
            يحتاج تصنيفًا
          </span>
        )}
      </div>

      {presetLabel && !value && !current && (
        <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[11px] leading-5 text-primary ring-1 ring-primary/20">
          يُصنّف تلقائيًا تحت: {presetLabel.subName} — يمكنك تغييره أدناه.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2.5">
        {/* المجال */}
        <Select dir="rtl" value={syncedDomain || 'none'} onValueChange={(v) => setDomain(v === 'none' ? '' : v)}>
          <SelectTrigger dir="rtl" className="w-full bg-card" aria-label="المجال">
            <SelectValue placeholder="اختر المجال" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="none">بدون تصنيف</SelectItem>
            {activeDomains.map((d: TDomainNode) => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{d.name}</span>
                  <FrameworkBadge isOfficial={d.isOfficial} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* المعيار */}
        <Select
          dir="rtl"
          value={syncedCriterion || 'none'}
          onValueChange={(v) => setCriterion(v === 'none' ? '' : v)}
          disabled={!selectedDomain}
        >
          <SelectTrigger dir="rtl" className="w-full bg-card" aria-label="المعيار">
            <SelectValue placeholder={selectedDomain ? 'اختر المعيار' : 'اختر المجال أولًا'} />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="none">بدون تحديد</SelectItem>
            {(selectedDomain?.criteria ?? []).filter((c) => !c.archived).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{c.name}</span>
                  <FrameworkBadge isOfficial={c.isOfficial} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* المعيار الفرعي */}
        <Select
          dir="rtl"
          value={value ?? 'none'}
          onValueChange={(v) => onChange(v === 'none' ? null : v)}
          disabled={!selectedCriterion}
        >
          <SelectTrigger dir="rtl" className="w-full bg-card" aria-label="المعيار الفرعي">
            <SelectValue placeholder={selectedCriterion ? 'اختر المعيار الفرعي' : 'اختر المعيار أولًا'} />
          </SelectTrigger>
          <SelectContent dir="rtl" className="max-h-64">
            <SelectItem value="none">بدون تحديد</SelectItem>
            {(selectedCriterion?.subs ?? []).filter((s) => !s.archived).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{s.name}</span>
                  <FrameworkBadge isOfficial={s.isOfficial} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">
        لا يُحسب المعيار الفرعي مكتملًا إلا بإنجاز مكتمل + شاهد مرتبط — والإنجاز المتكرر
        لنفس المعيار لا يرفع النسبة أكثر من مرة.
      </p>
    </div>
  )
}
