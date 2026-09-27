// ─── المزوّد المحلي (تطوير/اختبار فقط) — نفس سلوك القرص القائم ──
// يخزّن تحت storage/uploads بنفس بنية المسارات الآمنة school/user/year/id/file
// ولا يدعم الرفع الموقّع (العميل يعود تلقائيًا لمسار الوكيل).

import { createReadStream } from 'fs'
import { mkdir, open, stat, unlink, writeFile } from 'fs/promises'
import { Readable } from 'stream'
import path from 'path'
import type { StorageProvider, StorageStream, SignedUploadTicket } from './types'
import { isSafeRelativePath } from './paths'

export function localUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads')
}

function absOf(rel: string): string | null {
  if (!isSafeRelativePath(rel)) return null
  return path.join(localUploadDir(), rel)
}

export class LocalDiskStorage implements StorageProvider {
  readonly kind = 'local' as const
  readonly bucket = null

  async upload(rel: string, data: Buffer, _contentType: string): Promise<void> {
    const abs = absOf(rel)
    if (!abs) throw new Error('مسار تخزين غير صالح')
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, data)
  }

  async download(rel: string): Promise<Buffer | null> {
    const abs = absOf(rel)
    if (!abs) return null
    try {
      const { readFile } = await import('fs/promises')
      return await readFile(abs)
    } catch {
      return null
    }
  }

  async openStream(rel: string): Promise<StorageStream | null> {
    const abs = absOf(rel)
    if (!abs) return null
    try {
      const s = await stat(abs)
      if (!s.isFile()) return null
      const nodeStream = createReadStream(abs)
      return { stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, size: s.size }
    } catch {
      return null
    }
  }

  async stat(rel: string): Promise<{ size: number } | null> {
    const abs = absOf(rel)
    if (!abs) return null
    try {
      const s = await stat(abs)
      return s.isFile() ? { size: s.size } : null
    } catch {
      return null
    }
  }

  async downloadRange(rel: string, start: number, end: number): Promise<Buffer | null> {
    const abs = absOf(rel)
    if (!abs) return null
    try {
      const fh = await open(abs, 'r')
      try {
        const len = end - start + 1
        const buf = Buffer.alloc(len)
        const { bytesRead } = await fh.read(buf, 0, len, start)
        return buf.subarray(0, bytesRead)
      } finally {
        await fh.close()
      }
    } catch {
      return null
    }
  }

  async remove(rel: string): Promise<boolean> {
    const abs = absOf(rel)
    if (!abs) return false
    try {
      await unlink(abs)
      return true
    } catch {
      return false
    }
  }

  async exists(rel: string): Promise<boolean> {
    return (await this.stat(rel)) != null
  }

  async createSignedUrl(): Promise<string | null> {
    return null // المحلي يُقدَّم حصريًا عبر proxy الخادم
  }

  async createSignedUploadUrl(): Promise<SignedUploadTicket | null> {
    return null // غير مدعوم — العميل يعود لمسار الوكيل
  }
}
