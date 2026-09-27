/**
 * Branding assets — official Saudi Ministry of Education logo
 *
 * Source of truth: https://www.moe.gov.sa/MOECore/Images/Logo.svg
 * (fetched via real browser session through the ministry's WAF — see worklog Task 15)
 *
 * Produces in public/branding/:
 *  - ministry-logo.svg        : official vector paths, fill adapted to the ministry's
 *                               own brand teal #2FAB99 (the exact color moe.gov.sa pairs
 *                               with this white logo in its navbar) for white paper.
 *  - ministry-logo-white.svg  : pristine official white version (source artifact, for
 *                               dark surfaces / future use).
 *
 * No path is redrawn or modified — ONLY the single .st0 fill color changes.
 */
const fs = require('fs')
const path = require('path')

const SRC = '/home/z/my-project/scripts/logo-candidates/moe-official.svg'
const OUT_DIR = '/home/z/my-project/public/branding'

const PROVENANCE = ` Official asset source: https://www.moe.gov.sa/MOECore/Images/Logo.svg
  Retrieved: 2026-09-27 (via browser session; content-type image/svg+xml; Adobe Illustrator 22.1 export)
  Verified: VLM confirms the official Ministry of Education (Saudi Arabia) mark:
  dot-pattern open-book emblem + wordmark (Arabic + English).
  Ministry display contexts observed: white logo on navbar teal rgb(47,171,153)
  (#2FAB99) at moe.gov.sa, and the same mark in teal on white in the ministry's
  official X (@moe_gov_sa) profile. `

const svg = fs.readFileSync(SRC, 'utf8')

// sanity: official file markers
if (!svg.includes('viewBox="0 0 224.4 114.7"')) throw new Error('unexpected viewBox — source file changed?')
if (!svg.includes('.st0{fill:#FFFFFF;}')) throw new Error('expected single white fill rule not found')

const insertComment = (s) => s.replace(
  /(<svg[^>]*>)/,
  `$1\n<!--${PROVENANCE}-->\n<!-- Paths are the official artwork, unmodified. -->`
)

const teal = insertComment(svg).replace('.st0{fill:#FFFFFF;}', '.st0{fill:#2FAB99;}')
const white = insertComment(svg)

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'ministry-logo.svg'), teal)
fs.writeFileSync(path.join(OUT_DIR, 'ministry-logo-white.svg'), white)

// verify: parse again + render both to PNG for visual check
const sharp = require('/home/z/my-project/node_modules/sharp')
;(async () => {
  for (const name of ['ministry-logo.svg', 'ministry-logo-white.svg']) {
    const p = path.join(OUT_DIR, name)
    const buf = fs.readFileSync(p)
    const meta = await sharp(buf, { density: 96 }).metadata()
    const png = await sharp(buf, { density: 288 }).png().toBuffer() // 3x raster proof
    const out = `/home/z/my-project/scripts/logo-candidates/render-${name.replace('.svg', '')}.png`
    await sharp(png).flatten({ background: '#ffffff' }).toFile(out)
    console.log(name, '| bytes:', buf.length, '| viewBox size:', meta.width + 'x' + meta.height, '| rendered@3x ->', out)
  }
  console.log('DONE')
})().catch((e) => { console.error(e); process.exit(1) })
