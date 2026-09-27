// ─── مزوّد Supabase Storage (الإنتاج) — حاوية خاصة عبر Service Role ──
// ⚠️ SUPABASE_SERVICE_ROLE_KEY لجانب الخادم حصرًا — لا يجوز وصوله لحزمة العميل
//    إطلاقًا. كل عمليات هذا الملف تنفَّذ داخل مسارات API فقط.
// التقديم للمعلمين/المدير يمر عبر /api/files (proxy مصادَق) — لا روابط عامة دائمة.

import { StorageClient } from '@supabase/storage-js'
import type { StorageProvider, StorageStream, SignedUploadTicket } from './types'
import { isSafeRelativePath } from './paths'

/** ترميز كل مقطع على حدة (نفس سلوك encodeStoragePath في المكتبة الرسمية) */
function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/')
}

export class SupabaseStorage implements StorageProvider {
  readonly kind = 'supabase' as const
  readonly bucket: string

  private client: StorageClient
  private baseUrl: string
  private serviceKey: string

  constructor(url: string, serviceKey: string, bucket: string) {
    this.baseUrl = url.replace(/\/+$/, '')
    this.serviceKey = serviceKey
    this.bucket = bucket
    this.client = new StorageClient(`${this.baseUrl}/storage/v1`, {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    })
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceKey,
      authorization: `Bearer ${this.serviceKey}`,
    }
  }

  private objectUrl(rel: string): string {
    return `${this.baseUrl}/storage/v1/object/${this.bucket}/${encodePath(rel)}`
  }

  async upload(rel: string, data: Buffer, contentType: string): Promise<void> {
    if (!isSafeRelativePath(rel)) throw new Error('مسار تخزين غير صالح')
    const { error } = await this.client.from(this.bucket).upload(rel, data, {
      contentType,
      upsert: false,
    })
    if (error) throw new Error(`فشل الرفع إلى Supabase Storage: ${error.message}`)
  }

  async download(rel: string): Promise<Buffer | null> {
    if (!isSafeRelativePath(rel)) return null
    try {
      const { data, error } = await this.client.from(this.bucket).download(rel)
      if (error || !data) return null
      return Buffer.from(await data.arrayBuffer())
    } catch {
      return null
    }
  }

  async openStream(rel: string): Promise<StorageStream | null> {
    if (!isSafeRelativePath(rel)) return null
    try {
      const res = await fetch(this.objectUrl(rel), { headers: this.headers() })
      if (!res.ok || !res.body) return null
      const size = Number(res.headers.get('content-length')) || 0
      return { stream: res.body as ReadableStream<Uint8Array>, size }
    } catch {
      return null
    }
  }

  async stat(rel: string): Promise<{ size: number } | null> {
    if (!isSafeRelativePath(rel)) return null
    try {
      const res = await fetch(this.objectUrl(rel), {
        method: 'HEAD',
        headers: this.headers(),
      })
      if (!res.ok) return null
      const size = Number(res.headers.get('content-length'))
      return Number.isFinite(size) && size > 0 ? { size } : { size: 0 }
    } catch {
      return null
    }
  }

  async downloadRange(rel: string, start: number, end: number): Promise<Buffer | null> {
    if (!isSafeRelativePath(rel)) return null
    try {
      const res = await fetch(this.objectUrl(rel), {
        headers: { ...this.headers(), range: `bytes=${start}-${end}` },
      })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  async remove(rel: string): Promise<boolean> {
    if (!isSafeRelativePath(rel)) return false
    try {
      const { error } = await this.client.from(this.bucket).remove([rel])
      if (error) return false
      return true
    } catch {
      return false
    }
  }

  async exists(rel: string): Promise<boolean> {
    return (await this.stat(rel)) != null
  }

  async createSignedUrl(rel: string, expiresIn: number): Promise<string | null> {
    if (!isSafeRelativePath(rel)) return null
    try {
      const { data, error } = await this.client
        .from(this.bucket)
        .createSignedUrl(rel, expiresIn)
      if (error || !data?.signedUrl) return null
      return data.signedUrl
    } catch {
      return null
    }
  }

  async createSignedUploadUrl(rel: string): Promise<SignedUploadTicket | null> {
    if (!isSafeRelativePath(rel)) return null
    try {
      const { data, error } = await this.client.from(this.bucket).createSignedUploadUrl(rel)
      if (error || !data?.token) return null
      return { path: rel, token: data.token, signedUrl: data.signedUrl }
    } catch {
      return null
    }
  }
}
