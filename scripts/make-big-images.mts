/**
 * صور اختبار كبيرة واقعية — 4032×3024 مع ضوضاء (محاكاة ضغط الكاميرا)
 * الضوضاء ترفع حجم JPEG كما في الصور الحقيقية (3-6MB)
 */
import sharp from 'sharp'

async function make(path: string, w: number, h: number, label: string) {
  const base = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0E7F6E"/><stop offset="100%" stop-color="#1D2B27"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    ${Array.from({ length: 60 }, (_, i) =>
      `<circle cx="${(i * 167 + 90) % w}" cy="${(i * 233 + 120) % h}" r="${60 + (i * 91) % 300}" fill="#ffffff" opacity="0.08"/>`,
    ).join('')}
    <rect x="${w / 2 - 700}" y="${h / 2 - 180}" width="1400" height="360" rx="60" fill="#EDF5F2" opacity="0.95"/>
    <text x="${w / 2}" y="${h / 2 + 40}" font-size="160" font-weight="700" fill="#0A5D51" text-anchor="middle" font-family="sans-serif">${label}</text>
  </svg>`)

  // ضوضاء عالية التردد — تعكس واقعية أحجام الصور الفوتوغرافية
  const noise = await sharp({ create: { width: w, height: h, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 42 } } }).raw().toBuffer()
  const composed = await sharp(base)
    .composite([{ input: noise, raw: { width: w, height: h, channels: 3 }, blend: 'overlay' }])
    .jpeg({ quality: 92 })
    .toBuffer()

  const fs = await import('fs/promises')
  await fs.writeFile(path, composed)
  const size = (await fs.stat(path)).size
  console.log(`${path}: ${w}×${h} — ${(size / 1024 / 1024).toFixed(2)} MB`)
}

await make('/home/z/my-project/screenshots/big-photo-1.jpg', 4032, 3024, 'EVIDENCE-1')
await make('/home/z/my-project/screenshots/big-photo-2.jpg', 4032, 3024, 'EVIDENCE-2')
await make('/home/z/my-project/screenshots/big-photo-3.jpg', 4000, 3000, 'EVIDENCE-3')
await make('/home/z/my-project/screenshots/big-photo-4.jpg', 4000, 3000, 'EVIDENCE-4')
console.log('done')
