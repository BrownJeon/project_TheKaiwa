/**
 * 온디바이스 모델 배포본 점검 CLI — **모델 버전을 올리기 전 게이트**(speech/models/README §5, task-003f REV-021).
 *
 * 서버 #9 와 **같은 규칙**(src/modules/speech/stt/manifestRules.ts = 플러그인 ManifestValidator 를 옮긴 것)으로 manifest 를 검증하고,
 * 버전 디렉터리의 파일이 manifest 의 크기·sha256 과 같은지 본다. 여기서 FAIL 이면 서버는 manifest 를 내보내지 않고(404),
 * 통과하면 플러그인도 받아들인다(공용 픽스처로 두 검증기 판정이 같음을 단위 테스트가 보장).
 *
 *   bash scripts/models-verify.sh [모델 루트] [--package <디렉터리>] [--manifest <새 manifest 파일>] [--quick]
 *   모델 루트 기본 = SPEECH_MODELS_DIR > DATA_ROOT/models(.env). --quick = sha256 계산 생략(크기만).
 * 출력에 경로 밖 정보·시크릿 없음. 종료 코드 0 = 통과, 1 = 실패.
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ManifestError, parseManifestText } from '../src/modules/speech/stt/manifestRules'

const args = process.argv.slice(2)
const quick = args.includes('--quick')
const pkgIdx = args.indexOf('--package')
const pkg = pkgIdx >= 0 ? args[pkgIdx + 1] : 'reazonspeech-int8'
const mfIdx = args.indexOf('--manifest')
const manifestArg = mfIdx >= 0 ? args[mfIdx + 1] : null
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--package' && args[i - 1] !== '--manifest')
const root = resolve(positional[0] ?? process.env.SPEECH_MODELS_DIR ?? join(process.env.DATA_ROOT ?? '', 'models'))

let failed = 0
const say = (ok: boolean, what: string, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`)
}

function sha256(path: string): Promise<string> {
  return new Promise((ok, bad) => {
    const h = createHash('sha256')
    createReadStream(path)
      .on('data', (c) => h.update(c))
      .on('end', () => ok(h.digest('hex')))
      .on('error', bad)
  })
}

async function main(): Promise<void> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(pkg ?? '')) throw new Error('--package 는 디렉터리 이름 하나')
  // --manifest = 올리기 전 새 manifest(manifest.new.json)를 같은 패키지 디렉터리의 파일과 대조한다.
  const manifestPath = manifestArg ? resolve(manifestArg) : join(root, pkg, 'manifest.json')
  console.log(`models-verify: ${join(root, pkg)}${manifestArg ? ` (manifest=${manifestPath})` : ''}${quick ? ' (quick — sha256 생략)' : ''}`)
  if (!existsSync(manifestPath)) {
    say(false, 'manifest.json 있음', manifestPath)
    return
  }
  const text = readFileSync(manifestPath, 'utf8')
  let m
  try {
    m = parseManifestText(text)
  } catch (e) {
    say(false, '규칙 검증(플러그인과 같은 규칙)', e instanceof ManifestError ? e.message : String(e))
    return
  }
  say(true, '규칙 검증(플러그인과 같은 규칙)', `version=${m.version} files=${m.files.length} total=${m.totalBytes}`)
  const dir = join(root, pkg, m.version)
  say(existsSync(dir) && statSync(dir).isDirectory(), '버전 디렉터리 있음', m.version)
  for (const f of m.files) {
    const p = join(dir, f.path)
    if (!existsSync(p)) {
      say(false, `${f.role} ${f.path}`, '파일 없음')
      continue
    }
    const size = statSync(p).size
    if (size !== f.bytes) {
      say(false, `${f.role} ${f.path}`, `크기 ${size} ≠ ${f.bytes}`)
      continue
    }
    if (quick) {
      say(true, `${f.role} ${f.path}`, `${size}B`)
      continue
    }
    const got = await sha256(p)
    say(got === f.sha256, `${f.role} ${f.path}`, got === f.sha256 ? `${size}B sha256 일치` : 'sha256 불일치')
  }
}

main()
  .catch((e) => {
    failed++
    console.error('FAIL 실행 오류 —', e instanceof Error ? e.message : String(e))
  })
  .finally(() => {
    console.log(failed ? `\nmodels-verify: FAIL ${failed}건 — 이 배포본은 올리지 않는다` : '\nmodels-verify: OK')
    process.exitCode = failed ? 1 : 0
  })
