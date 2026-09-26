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
import { ATTACHMENT_KINDS } from '@/lib/constants'
import { formatDateShort, formatSize, relTime } from '@/lib/format'
import { toast } from 'sonner'
import type { TAttachment } from '@/lib/types'

export function EvidenceView() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [linked, setLinked] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const { data, isLoading, error, refetch } = useAttachments({
    q: q.trim() || undefined,
    kind: kind || undefined,
    linked: linked || undefined,
  })
  const qc = useQueryClient()
  const openForm = useApp((s) => s.openForm)

  const attachments = data?.attachments ?? []

  const remove = async (a: TAttachment) => {
    const linksCount = a.links?.length ?? 0
    const msg = linksCount > 0
      ? `هذا الشاهد مرتبط بـ ${linksCount} عنصر. حذفه يزيله من كل العناصر المرتبطة.\nهل تريد حذفه نهائيًا؟`
      : 'هل تريد حذف هذا الشاهد نهائيًا؟'
    if (!confirm(msg)) return
    const res = await fetch(`/api/attachments/${a.id}`, { method: 'DELETE' })
    if (res.ok) {
      if (a.url?.startsWith('/uploads/')) {
        fetch(`/api/upload?url=${encodeURIComponent(a.url)}`, { method: 'DELETE' }).catch(() => {})
      }
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
        <div className="relative min-w-52 flex-1">
          <Icon name="Search" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            dir="rtl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في الشواهد…"
            className="bg-card pr-10"
            aria-label="البحث في الشواهد"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="فلترة النوع">
          <button
            onClick={() => setKind('')}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${!kind ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            الكل
          </button>
          {Object.entries(ATTACHMENT_KINDS).filter(([k]) => k !== 'OTHER').map(([k, v]) => (
            <button
              key={k}
              onClick={() => setKind(kind === k ? '' : k)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${kind === k ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Icon name={v.icon} className="size-3.5" />
              {v.label}
            </button>
          ))}
          <button
            onClick={() => setLinked(linked === 'linked' ? '' : 'linked')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${linked === 'linked' ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            <Icon name="Link2" className="size-3.5" />
            مرتبط
          </button>
          <button
            onClick={() => setLinked(linked === 'unlinked' ? '' : 'unlinked')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${linked === 'unlinked' ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            <Icon name="Unlink" className="size-3.5" />
            غير مرتبط
          </button>
        </div>

        <div className="mr-auto flex items-center gap-1 rounded-full border border-border bg-card p-1" role="group" aria-label="طريقة العرض">
          <button onClick={() => setLayout('grid')} className={`flex size-7 items-center justify-center rounded-full transition-colors ${layout === 'grid' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`} aria-label="عرض شبكي" aria-pressed={layout === 'grid'}>
            <Icon name="LayoutGrid" className="size-3.5" />
          </button>
          <button onClick={() => setLayout('list')} className={`flex size-7 items-center justify-center rounded-full transition-colors ${layout === 'list' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`} aria-label="عرض قائمة" aria-pressed={layout === 'list'}>
            <Icon name="List" className="size-3.5" />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {attachments.map((a, i) => (
            <div key={a.id} className={`group anim-fade-up anim-delay-${Math.min((i % 4) + 1, 4)} overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift`}>
                <div className="relative h-36 bg-muted">
                  {a.kind === 'IMAGE' && a.url ? (
                    <img src={a.url} alt={a.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-bl from-secondary to-muted">
                      <Icon name={ATTACHMENT_KINDS[a.kind]?.icon ?? 'Paperclip'} className="size-9 text-primary/50" strokeWidth={1.5} />
                    </div>
                  )}
                  <button
                    onClick={() => remove(a)}
                    className="absolute left-2.5 top-2.5 flex size-8 items-center justify-center rounded-lg bg-white/85 text-muted-foreground opacity-0 backdrop-blur transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
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
                      <Icon name="Link2" className="size-3 text-primary" />
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
                    <span className="flex items-center gap-1"><Icon name="Link2" className="size-3 text-primary" />{a.links.length} ارتباط</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary" aria-label="فتح">
                    <Icon name="ExternalLink" className="size-4" />
                  </a>
                )}
                <button onClick={() => remove(a)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="حذف">
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
