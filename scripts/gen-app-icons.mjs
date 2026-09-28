#!/usr/bin/env node
/**
 * 안드로이드 런처 아이콘·스플래시 생성기 — task-003f.
 *
 *   node scripts/gen-app-icons.mjs
 *
 * ── 원본은 웹 아이콘이다 ─────────────────────────────────────────────────────
 * 앱 아이콘을 따로 그리지 않고 **웹 매니페스트 아이콘(`public/icons/`)에서 뽑는다** — 홈 화면의 PWA 아이콘과
 * APK 아이콘이 같아야 하고, 도안을 바꿀 때 고칠 곳이 한 곳이어야 한다. 도안을 바꾸려면 `public/icons/*.png` 를 바꾼 뒤
 * 이 스크립트를 다시 돌린다(산출물 `android/app/src/main/res/**` 을 손으로 고치지 않는다).
 *   - 적응형(API 26+) 배경 = maskable 아이콘의 바탕색, 전경·테마(단색) = maskable 에서 밝은 도형만 뽑은 알파
 *   - 구형 런처 = `icon-512.png`(둥근 사각), 원형 = maskable 을 원으로 자름
 *   - 스플래시 = 웹 `--ground` 단색(템플릿의 Capacitor 로고 제거)
 * 아이콘은 APK 안에 들어간다 → 바꾸면 네이티브 변경(APK 재빌드·versionCode 증가).
 *
 * ── sharp ───────────────────────────────────────────────────────────────────
 * NFS(noexec)에는 node_modules 가 없어 미러(`~/.node-local/thekaiwa`)의 sharp(Next.js 가 끌어옴)를 빌려 쓴다 —
 * 빌드·런타임 경로가 아니라 아이콘을 다시 뽑을 때만 도는 개발 도구다.
 */
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIRROR = process.env.THEKAIWA_LOCAL ?? join(homedir(), '.node-local/thekaiwa')

let sharp
try {
  sharp = createRequire(join(MIRROR, 'package.json'))('sharp')
} catch {
  console.error(`[gen-app-icons] sharp 를 찾지 못했습니다(${MIRROR}). 미러에서 npm install 을 먼저 돌리세요.`)
  process.exit(1)
}

const MASKABLE = join(ROOT, 'public/icons/icon-maskable-512.png')
const ANY = join(ROOT, 'public/icons/icon-512.png')
const RES = join(ROOT, 'android/app/src/main/res')
const SPLASH_BG = '#f6f7f4' // globals.css --ground(라이트)

/**
 * 적응형 전경 축척. 108dp 캔버스에서 어떤 마스크로 잘려도 남는 안전 영역은 지름 66dp 원(반지름 0.306).
 * maskable 도안에서 가장 먼 점(그릇 테 양 끝)은 중심에서 0.328 — 0.72 배면 0.236 으로 안전 영역 안쪽에 여백이 남는다
 * (0.84 는 안전 영역 안이지만 원형 마스크에서 테가 가장자리에 붙어 보였다 — 2026-09-28 미리보기).
 */
const FG_SCALE = 0.72
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

function hex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** maskable 에서 밝은 도형만 흰색+알파로 뽑는다(바탕색과 먼 정도로 알파를 매겨 가장자리를 부드럽게). */
async function glyph() {
  const { data, info } = await sharp(MASKABLE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const [br, bg, bb] = [data[0], data[1], data[2]]
  const out = Buffer.alloc(info.width * info.height * 4)
  const far = Math.hypot(255 - br, 255 - bg, 255 - bb)
  for (let i = 0; i < info.width * info.height; i++) {
    const d = Math.hypot(data[i * 4] - br, data[i * 4 + 1] - bg, data[i * 4 + 2] - bb)
    const a = Math.max(0, Math.min(1, (d / far - 0.15) / 0.7))
    out[i * 4] = 255
    out[i * 4 + 1] = 255
    out[i * 4 + 2] = 255
    out[i * 4 + 3] = Math.round(a * 255)
  }
  return { png: await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer(), bg: hex(br, bg, bb) }
}

async function layer(glyphPng, px) {
  const inner = Math.round(px * FG_SCALE)
  const scaled = await sharp(glyphPng).resize(inner, inner).png().toBuffer()
  const pad = Math.floor((px - inner) / 2)
  return sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
}

async function round(px) {
  const mask = Buffer.from(`<svg width="${px}" height="${px}"><circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}" fill="#fff"/></svg>`)
  return sharp(MASKABLE).resize(px, px).composite([{ input: mask, blend: 'dest-in' }]).png({ compressionLevel: 9 })
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

async function main() {
  const { png, bg } = await glyph()
  const written = []

  writeText(
    join(RES, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- scripts/gen-app-icons.mjs 가 생성: 웹 maskable 아이콘의 바탕색 -->\n<resources>\n    <color name="ic_launcher_background">${bg}</color>\n</resources>\n`,
  )
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- scripts/gen-app-icons.mjs 가 생성: 직접 고치지 말고 스크립트를 다시 돌린다 -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
  writeText(join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive)
  writeText(join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive)
  written.push(`values/ic_launcher_background.xml (${bg})`, 'mipmap-anydpi-v26/ic_launcher{,_round}.xml')

  for (const [name, f] of Object.entries(DENSITY)) {
    const dir = join(RES, `mipmap-${name}`)
    mkdirSync(dir, { recursive: true })
    const fg = Math.round(108 * f)
    const legacy = Math.round(48 * f)
    await (await layer(png, fg)).toFile(join(dir, 'ic_launcher_foreground.png'))
    await (await layer(png, fg)).toFile(join(dir, 'ic_launcher_monochrome.png'))
    await sharp(ANY).resize(legacy, legacy).png({ compressionLevel: 9 }).toFile(join(dir, 'ic_launcher.png'))
    await (await round(legacy)).toFile(join(dir, 'ic_launcher_round.png'))
    written.push(`mipmap-${name}/ic_launcher{,_round,_foreground,_monochrome}.png`)
  }

  // 템플릿 드로어블 전경(Capacitor 로고 벡터)은 쓰지 않는다 — mipmap 전경이 이긴다(v26+). 남겨 두면 혼동만 준다.
  const legacyVector = join(RES, 'drawable-v24/ic_launcher_foreground.xml')
  if (existsSync(legacyVector)) {
    writeText(
      legacyVector,
      `<?xml version="1.0" encoding="utf-8"?>\n<!-- scripts/gen-app-icons.mjs: 쓰이지 않는 자리표시(런처 전경은 mipmap-*/ic_launcher_foreground.png) -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n    <path android:fillColor="#00000000" android:pathData="M0,0h108v108h-108z" />\n</vector>\n`,
    )
  }

  for (const d of readdirSync(RES).filter((x) => x.startsWith('drawable'))) {
    const p = join(RES, d, 'splash.png')
    if (!existsSync(p)) continue
    const { width, height } = await sharp(p).metadata()
    const tmp = `${p}.tmp.png`
    await sharp({ create: { width, height, channels: 3, background: SPLASH_BG } }).png({ compressionLevel: 9 }).toFile(tmp)
    renameSync(tmp, p)
    written.push(`${d}/splash.png (${width}×${height})`)
  }

  for (const w of written) console.log('  ✓', w)
  console.log('\n[gen-app-icons] 완료 — APK 를 다시 빌드해야 기기에 반영됩니다: bash scripts/build-apk.sh')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
