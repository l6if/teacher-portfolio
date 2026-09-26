'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAttachments } from '@/hooks/use-data'
import { useApp } from '@/store/app-store'
import { Icon } from '@/components/shared/icon'
import { KindBadge } from '@/components/shared/badges'
import { EmptyState, LoadingState, ErrorState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { ATTACHMENT_KINDS } from '@/lib/constants'
import { formatDateShort, formatSize, relTime } from '@/lib/format'
import { toast } from 'sonner'
import type { TAttachment } from '@/lib/types'

export function EvidenceView() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [linked, setLinked] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { data, isLoading, error, refetch } = useAttachments({
    q: q.trim() || undefined,
    kind: kind || undefined,
    linked: linked || undefined,
  })
  const qc = useQueryClient()
  const openForm = useApp((s) => s.openForm)

  const attachments = data?.attachments ?? []
  const activeFilters = (kind ? 1 : 0) + (linked ? 1 : 0)

  const remove = async (a: TAttachment) => {
    const linksCount = a.links?.length ?? 0
    const msg = linksCount > 0
      ? `هذا الشاهد مرتبط بـ ${linksCount} عنصر. حذفه يزيله من كل العناصر المرتبطة.\nهل تريد حذفه نهائيًا؟`
      : 'هل تريد حذف هذا الشاهد نهائيًا؟'
    if (!confirm(msg)) return
    // حذف الشاهد من الخادم يزيل روابطه وملفه المرفوع من القرص معًا
    const res = await fetch(`/api/attachments/${a.id}`, { method: 'DELETE' })
    if (res.ok) {
      await qc.invalidateQueries()
      toast.success('تم حذف الشاهد من المكتبة')
    } else toast.error('تعذر الحذف')
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'الشواهد' }]}
        title="مكتبة الشواهد"
        description="كل صورك وملفاتك وروابطك في مكان واحد — الشاهد الواحد يُرفع مرة واحدة ويُربط بإنجازات وأهداف متعددة."
        icon="LibraryBig"
      />

      {/* شريط البحث والفلاتر */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 anim-fade-up">
        <div className="relative min-w-0 flex-1">
          <Icon name="Search" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            dir="rtl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في الشواهد…"
            className="h-11 bg-card pr-10"
            aria-label="البحث في الشواهد"
          />
        </div>

        {/* فلاتر النوع والارتباط — مرئية مباشرة على الشاشات الأكبر */}
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex" role="group" aria-label="فلترة النوع">
          <button
            onClick={() => setKind('')}
            className={`min-h-9 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${!kind ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            الكل
          </button>
          {Object.entries(ATTACHMENT_KINDS).filter(([k]) => k !== 'OTHER').map(([k, v]) => (
            <button
              key={k}
              onClick={() => setKind(kind === k ? '' : k)}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${kind === k ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Icon name={v.icon} className="size-3.5" />
              {v.label}
            </button>
          ))}
          <button
            onClick={() => setLinked(linked === 'linked' ? '' : 'linked')}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${linked === 'linked' ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            <Icon name="Link2" className="size-3.5" />
            مرتبط
          </button>
          <button
            onClick={() => setLinked(linked === 'unlinked' ? '' : 'unlinked')}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${linked === 'unlinked' ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            <Icon name="Unlink" className="size-3.5" />
            غير مرتبط
          </button>
        </div>

        {/* تصفية — Bottom Sheet على الجوال مع شارة عدد الفلاتر */}
        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerTrigger asChild>
            <button
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:hidden"
              aria-label="تصفية الشواهد"
            >
              <Icon name="SlidersHorizontal" className="size-4" />
              تصفية
              {activeFilters > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{activeFilters}</span>
              )}
            </button>
          </DrawerTrigger>
          <DrawerContent dir="rtl">
            <div className="mx-auto w-full max-w-sm pb-6">
              <DrawerHeader>
                <DrawerTitle className="text-right">تصفية الشواهد</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-4 px-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">النوع</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setKind('')} className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${!kind ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground'}`}>الكل</button>
                    {Object.entries(ATTACHMENT_KINDS).filter(([k]) => k !== 'OTHER').map(([k, v]) => (
                      <button key={k} onClick={() => setKind(kind === k ? '' : k)} className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${kind === k ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground'}`}>
                        <Icon name={v.icon} className="size-4" />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">حالة الارتباط</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setLinked(linked === 'linked' ? '' : 'linked')} className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${linked === 'linked' ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground'}`}>
                      <Icon name="Link2" className="size-4" />
                      مرتبط
                    </button>
                    <button onClick={() => setLinked(linked === 'unlinked' ? '' : 'unlinked')} className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${linked === 'unlinked' ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground'}`}>
                      <Icon name="Unlink" className="size-4" />
                      غير مرتبط
                    </button>
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button onClick={() => { setKind(''); setLinked('') }} className="min-h-11 w-full rounded-full border border-border text-sm text-muted-foreground transition-colors hover:bg-muted">
                    مسح الفلاتر ({activeFilters})
                  </button>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        <div className="mr-auto flex items-center gap-1 rounded-full border border-border bg-card p-1.5" role="group" aria-label="طريقة العرض">
          <button onClick={() => setLayout('grid')} className={`flex size-8 items-center justify-center rounded-full transition-colors ${layout === 'grid' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`} aria-label="عرض شبكي" aria-pressed={layout === 'grid'}>
            <Icon name="LayoutGrid" className="size-4" />
          </button>
          <button onClick={() => setLayout('list')} className={`flex size-8 items-center justify-center rounded-full transition-colors ${layout === 'list' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`} aria-label="عرض قائمة" aria-pressed={layout === 'list'}>
            <Icon name="List" className="size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message="تعذر تحميل مكتبة الشواهد." onRetry={() => refetch()} />
      ) : attachments.length === 0 ? (
        q || kind || linked ? (
          <EmptyState
            icon="Search"
            title="لا توجد نتائج مطابقة"
            description="جرّب تعديل كلمة البحث أو إلغاء الفلاتر — الشواهد موجودة بانتظار كلمة البحث الصحيحة."
            secondaryLabel="مسح الفلاتر"
            onSecondary={() => { setQ(''); setKind(''); setLinked('') }}
          />
        ) : (
          <EmptyState
            icon="LibraryBig"
            title="مكتبة شواهدك فارغة حتى الآن"
            description="ارفع أول شاهد عند إضافة أي إنجاز — الصور وشهادات الشكر والملفات كلها تتجمع هنا تلقائيًا لتستخدمها في أي تقرير."
            actionLabel="إضافة إنجاز بشواهده"
            onAction={() => openForm()}
          />
        )
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {attachments.map((a, i) => (
            <div key={a.id} className={`group anim-fade-up anim-delay-${Math.min((i % 4) + 1, 4)} overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift`}>
                <div className="relative aspect-[4/3] bg-muted">
                  {a.kind === 'IMAGE' && a.url ? (
                    <img src={a.url} alt={a.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-bl from-secondary to-muted">
                      <Icon name={ATTACHMENT_KINDS[a.kind]?.icon ?? 'Paperclip'} className="size-9 text-primary/50" strokeWidth={1.5} />
                    </div>
                  )}
                  <button
                    onClick={() => remove(a)}
                    className="absolute left-2 top-2 flex size-10 items-center justify-center rounded-xl bg-white/90 text-muted-foreground opacity-100 backdrop-blur transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`حذف ${a.title}`}
                  >
                    <Icon name="Trash2" className="size-4" />
                  </button>
                </div>
                <div className="p-4">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{a.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <KindBadge kind={a.kind} />
                    <span className="text-[10px] text-muted-foreground">{a.fileSize ? formatSize(a.fileSize) : relTime(a.createdAt)}</span>
                  </div>
                  {(a.links?.length ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                      <Icon name="Link2" className="size-3 shrink-0 text-primary" />
                      <span className="truncate">مرتبط بـ {a.links!.length} عنصر{a.links!.some((l) => l.goal) ? ' — منها هدف' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 transition-shadow hover:shadow-soft anim-fade-up">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {a.kind === 'IMAGE' && a.url ? (
                  <img src={a.url} alt={a.title} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-secondary">
                    <Icon name={ATTACHMENT_KINDS[a.kind]?.icon ?? 'Paperclip'} className="size-5 text-primary" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <KindBadge kind={a.kind} />
                  {a.fileSize && <span>{formatSize(a.fileSize)}</span>}
                  <span>{formatDateShort(a.createdAt)}</span>
                  {a.links && a.links.length > 0 && (
                    <span className="flex items-center gap-1"><Icon name="Link2" className="size-3 shrink-0 text-primary" />{a.links.length} ارتباط</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary" aria-label="فتح">
                    <Icon name="ExternalLink" className="size-4" />
                  </a>
                )}
                <button onClick={() => remove(a)} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="حذف">
                  <Icon name="Trash2" className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
