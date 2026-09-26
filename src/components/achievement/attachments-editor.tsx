'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/store/app-store'
import { useAttachments, useScope } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { AttachmentCard } from '@/components/shared/attachment-ui'
import { LoadingState } from '@/components/shared/states'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { TAttachment } from '@/lib/types'
import { ATTACHMENT_KINDS } from '@/lib/constants'

// ─── بنية الرفع: وكيل أم رفع مباشر موقّع (ملفات كبيرة، بيئة Supabase) ──
const PROXY_LIMIT_BYTES =
  Number(process.env.NEXT_PUBLIC_PROXY_UPLOAD_LIMIT_MB || 4) * 1024 * 1024
const SUPABASE_PUB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'teacher-evidence'

/**
 * رفع ملف كبير عبر رابط موقّع قصير العمر مباشرة إلى التخزين —
 * لا يمر عبر دالة الخادم (تجاوزًا لحدود جسم الطلب في serverless).
 * يعيد null إذا كان الوضع المحلي (لا دعم للرفع الموقّع) فيعود الطلب لمسار الوكيل.
 * التحقق النهائي من البصمة والحجم يبقى في الخادم (/api/upload/complete).
 */
async function uploadLargeFile(file: File, yearId: string | null): Promise<TAttachment | null> {
  const res = await fetch('/api/upload/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type || undefined, size: file.size, yearId }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.mode !== 'direct') return null
  if (!SUPABASE_PUB_URL || !SUPABASE_PUB_ANON) return null

  const { StorageClient } = await import('@supabase/storage-js')
  const storage = new StorageClient(`${SUPABASE_PUB_URL}/storage/v1`, { apikey: SUPABASE_PUB_ANON })
  const { error } = await storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(data.path, data.token, file, {
      contentType: file.type || 'application/octet-stream',
    })
  if (error) throw new Error(error.message)

  const done = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachmentId: data.attachmentId, fileName: file.name, yearId }),
  })
  const dd = await done.json().catch(() => null)
  if (!done.ok || !dd) throw new Error(dd?.error ?? file.name)
  return dd.attachment as TAttachment
}

/** حوار إضافة رابط */
function AddLinkDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (a: TAttachment) => void }) {
  const { yearId } = useScope()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!url.startsWith('http')) {
      toast.error('الرجاء إدخال رابط صحيح يبدأ بـ http')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'LINK', title: title || url, url, yearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onAdded(data.attachment)
      onOpenChange(false)
      setTitle(''); setUrl('')
      toast.success('تمت إضافة الرابط إلى الشواهد')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذرت الإضافة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="dialog-sheet sm:max-w-md">
        <DialogHeader className="text-right">
          <DialogTitle>إضافة رابط</DialogTitle>
          <DialogDescription>رابط صفحة، أو مستند سحابي، أو مقطع فيديو — يُحفظ في مكتبة شواهدك.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">عنوان الرابط</label>
            <Input dir="rtl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: فصول اللغة العربية — منصة مدرستي" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الرابط</label>
            <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="text-left" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="Link2" className="size-4" />}
            إضافة
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** منتقي الشواهد من المكتبة */
function LibraryPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (selected: TAttachment[]) => void }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<string>('')
  const { data, isLoading } = useAttachments({ q: q || undefined, kind: kind || undefined })
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const attachments = data?.attachments ?? []
  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="dialog-sheet flex h-[85dvh] flex-col rounded-t-3xl sm:max-w-xl">
        <DialogHeader className="text-right">
          <DialogTitle>اختيار شاهد من مكتبتك</DialogTitle>
          <DialogDescription>الشاهد الواحد يمكن ربطه بأكثر من إنجاز وهدف دون رفع الملف مرة أخرى.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="Search" className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input dir="rtl" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالعنوان أو الكلمات المفتاحية…" className="bg-card pr-9" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setKind('')} className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${!kind ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>الكل</button>
          {Object.entries(ATTACHMENT_KINDS).filter(([k]) => k !== 'OTHER').map(([k, v]) => (
            <button key={k} onClick={() => setKind(k === kind ? '' : k)} className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${kind === k ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>{v.label}</button>
          ))}
        </div>

        <div className="scrollbar-slim -mx-1 flex-1 overflow-y-auto px-1">
          {isLoading ? (
            <LoadingState rows={3} />
          ) : attachments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد شواهد مطابقة في مكتبتك بعد.</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((a) => {
                const meta = ATTACHMENT_KINDS[a.kind] ?? ATTACHMENT_KINDS.OTHER
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected((s) => ({ ...s, [a.id]: !s[a.id] }))}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right transition-colors ${selected[a.id] ? 'border-primary bg-secondary/60' : 'border-border bg-card hover:bg-muted/60'}`}
                  >
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-md border-2" style={{ borderColor: selected[a.id] ? 'var(--primary)' : 'var(--border)' }}>
                      {selected[a.id] && <Icon name="Check" className="size-3.5 text-primary" strokeWidth={3} />}
                    </div>
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${a.kind === 'IMAGE' ? 'overflow-hidden' : 'bg-muted'}`}>
                      {a.kind === 'IMAGE' && a.url ? (
                        <img src={a.url} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <Icon name={meta.icon} className="size-4.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {meta.label}{a.links && a.links.length > 0 ? ` • مرتبط بـ ${a.links.length} عنصر` : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3 sm:justify-between">
          <span className="text-xs text-muted-foreground">{selectedCount ? `${selectedCount} محددًا` : 'لم تحدد بعد'}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button
              disabled={!selectedCount}
              onClick={() => {
                onPick(attachments.filter((a) => selected[a.id]))
                setSelected({})
                onOpenChange(false)
              }}
              className="gap-2"
            >
              <Icon name="Check" className="size-4" />
              إضافة المحدد
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** محرر الشواهد — رفع + مكتبة + روابط */
export function AttachmentsEditor({
  attachments,
  onChange,
}: {
  attachments: TAttachment[]
  onChange: (next: TAttachment[]) => void
}) {
  const { yearId } = useScope()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState<string[]>([])
  const [linkOpen, setLinkOpen] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const setFormOpen = useApp((s) => s.closeForm)

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true)
    setUploadProgress({ done: 0, total: list.length })
    setErrors([])
    const added: TAttachment[] = []
    const failed: string[] = []
    for (const file of list) {
      try {
        // الملفات الكبيرة: مسار الرفع المباشر الموقّع (يعود للوكيل محليًا تلقائيًا)
        if (file.size > PROXY_LIMIT_BYTES) {
          const direct = await uploadLargeFile(file, yearId)
          if (direct) {
            added.push(direct)
            setUploadProgress((p) => ({ ...p, done: p.done + 1 }))
            continue
          }
        }
        const fd = new FormData()
        fd.append('file', file)
        if (yearId) fd.append('yearId', yearId)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? file.name)
        added.push(data.attachment)
      } catch {
        failed.push(file.name)
      }
      setUploadProgress((p) => ({ ...p, done: p.done + 1 }))
    }
    if (added.length) {
      onChange([...attachments, ...added])
      await qc.invalidateQueries({ queryKey: ['attachments'] })
      toast.success(added.length === 1 ? 'تم رفع الشاهد بنجاح' : `تم رفع ${added.length} شواهد`)
    }
    if (failed.length) {
      setErrors(failed)
      toast.error(failed.length === 1 ? 'تعذر رفع هذا الملف. حاول مرة أخرى.' : `تعذر رفع ${failed.length} ملفات — لم يتأثر باقي عملك.`)
    }
    setUploading(false)
    setUploadProgress({ done: 0, total: 0 })
  }

  return (
    <div className="space-y-3">
      {/* منطقة السحب والإفلات */}
      <div
        role="button"
        tabIndex={0}
        aria-label="رفع ملفات — اسحب وأفلت هنا أو اضغط للاختيار"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          dragOver ? 'border-primary bg-secondary/70 scale-[1.01]' : 'border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/70'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,video/*"
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = '' }}
        />
        {uploading ? (
          <>
            <Icon name="Loader2" className="size-7 animate-spin text-primary" />
            <p className="mt-2.5 text-sm font-medium text-foreground">
              جارٍ رفع الشواهد…{uploadProgress.total > 1 ? ` (${uploadProgress.done + 1}/${uploadProgress.total})` : ''}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[11px] text-muted-foreground shadow-soft">
              <Icon name="Image" className="size-3.5" /> صور
              <span className="text-border">•</span>
              <Icon name="FileText" className="size-3.5" /> PDF
              <span className="text-border">•</span>
              <Icon name="Table" className="size-3.5" /> Excel
              <span className="text-border">•</span>
              <Icon name="Video" className="size-3.5" /> فيديو
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              اسحب الملفات هنا <span className="font-normal text-muted-foreground">أو اضغط للاختيار</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">حتى 25 م.ب للملف — يمكن رفع أكثر من شاهد معًا</p>
          </>
        )}
      </div>

      {/* خطأ الرفع */}
      {errors.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon name="CircleAlert" className="size-4 shrink-0 text-destructive" />
            <p className="truncate text-xs text-destructive">تعذر رفع: {errors.join('، ')}</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="min-h-9 shrink-0 rounded-full border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* الشواهد الحالية */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((a) => (
            <AttachmentCard
              key={a.id}
              attachment={a}
              onRemove={() => onChange(attachments.filter((x) => x.id !== a.id))}
            />
          ))}
        </div>
      )}

      {/* إضافة من المكتبة / رابط */}
      <div className="flex flex-wrap gap-2.5">
        <Button variant="outline" size="sm" onClick={() => setLibOpen(true)} className="min-h-10 gap-2 rounded-full">
          <Icon name="LibraryBig" className="size-4 text-primary" />
          اختيار من مكتبة الشواهد
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)} className="min-h-10 gap-2 rounded-full">
          <Icon name="Link2" className="size-4 text-primary" />
          إضافة رابط
        </Button>
      </div>

      <AddLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onAdded={(a) => onChange([...attachments, a])}
      />
      <LibraryPicker
        open={libOpen}
        onOpenChange={setLibOpen}
        onPick={(picked) => onChange([...attachments, ...picked])}
      />
    </div>
  )
}
