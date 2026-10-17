/**
 * task-072 — 단어 추가 일본어 도우미의 **배선**(screens §30-14 ③). jsdom 이 없어 실제 클릭·키 입력은 못 돌리므로, 주석을 걷은 소스에서 「동작 의미가 있는 호출」이
 * 제자리에 있는지 본다(호출이 빠지거나 순서·조건이 바뀌면 실패). 규칙 자체는 `wordHelperLogic.test.ts`, 마크업은 `wordHelperRender.test.ts`, 실제 동작은 QA(실제 Next 라우터).
 * 함정 번호는 §30-11.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { readCode } from '../../__tests__/sourceCode'

const COMP = join(process.cwd(), 'src/components')
const code = (rel: string) => readCode(join(COMP, rel))
const squash = (rel: string) => code(rel).replace(/\s+/g, '')
/** squash 한 소스에서 두 표지 사이(앞 표지 포함). 표지를 못 찾으면 실패 — 파일이 바뀌면 이 시험도 같이 고친다. */
function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from)
  const b = src.indexOf(to, a + from.length)
  assert.ok(a >= 0 && b > a, `표지를 찾지 못함: ${from} … ${to}`)
  return src.slice(a, b)
}
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0

const NEW_FILES = ['vocab/wordHelperCopy.ts', 'vocab/wordHelperLogic.ts', 'vocab/useWordPhraseHelper.ts', 'vocab/WordPhraseHelper.tsx', 'vocab/WordHelperCard.tsx', 'vocab/WordHelperTip.tsx']

test('가あ·안내·패널은 1단계 분기에만 있고, 폼 단계·뜻 찾는 중·수정 시트에는 도우미 import/사용이 없다(D1′)', () => {
  const sheet = code('vocab/WordAddSheet.tsx')
  const a = sheet.indexOf("} else if (step === 'surface') {")
  const b = sheet.indexOf('} else {', a)
  assert.ok(a > 0 && b > a, '1단계 분기 표지')
  const surface = sheet.slice(a, b)
  for (const jsx of ['<PhraseHelperButton', '<WordHelperTip', '<WordPhraseHelper']) {
    assert.equal(count(sheet, new RegExp(jsx, 'g')), 1, `${jsx} 는 한 번만`)
    assert.ok(surface.includes(jsx), `${jsx} 는 1단계 분기 안`)
  }
  // 뜻 찾는 중(enriching) 분기에는 도우미 화면 부품이 없다
  const enriching = sheet.slice(sheet.indexOf("if (step === 'enriching') {"), a)
  assert.doesNotMatch(enriching, /Helper|helper/)
  for (const f of ['vocab/WordForm.tsx', 'vocab/WordDetailSheet.tsx']) assert.doesNotMatch(code(f), /WordPhraseHelper|PhraseHelperButton|WordHelperTip|useWordPhraseHelper|wordHelper/, f)
})

test('배치 — 패널은 표현 블록 뒤·[뜻 채우기] 앞, 낭독 줄(sr)은 표현 블록 안에 늘 마운트, 가あ 는 표현 칸 슬롯(trailing)', () => {
  const sheet = squash('vocab/WordAddSheet.tsx')
  const at = (s: string) => sheet.indexOf(s)
  assert.ok(at('trailing={') > at('<WordMicField') && at('afterLabel={') > at('trailing={'))
  assert.ok(at('id={WORD_HELPER_IDS.announce}') > at('{blockedLine}') && at('id={WORD_HELPER_IDS.announce}') < at('<WordPhraseHelper'))
  assert.ok(at('<WordPhraseHelper') < at('<Btntype="submit"'), '패널은 [뜻 채우기] 앞')
  assert.match(sheet, /\{helper\.open\?<WordPhraseHelperh=\{helper\}qRef=\{helperQRef\}askRef=\{helperAskRef\}onClose=\{closeToButton\}onFill=\{fillFromHelper\}\/>:null\}/)
  assert.match(sheet, /<spanid=\{WORD_HELPER_IDS\.announce\}className="sr-only"role="status">\{helper\.fillAnnounce\}<\/span>/)
  assert.match(sheet, /locked=\{false\}/, '단어 시트엔 녹음·턴 잠금이 없다')
  assert.match(sheet, /afterLabel=\{tipShown\?<WordHelperTiponClose=\{\(\)=>setTipOpen\(false\)\}\/>:null\}/)
})

test('[뜻 채우기](enrich) — 검증을 통과해 시작할 때만 도우미 요청을 취소하고 닫는다(함정 ③, 빈 표현·80자 초과·429 대기는 그대로)', () => {
  const add = squash('vocab/WordAddSheet.tsx')
  const enrich = between(add, 'constenrich=async', 'conststopEnrich')
  assert.match(enrich, /return\}mic\.close\(\)abortRef\.current\?\.abort\(\)helper\.cancelPending\(\)helper\.close\(\)constctrl=newAbortController\(\)/)
  assert.equal(count(enrich, /helper\./g), 2)
  // 두 호출은 모든 early return(진행 중·429 대기·검증 실패) 뒤에 있다
  const firstHelper = enrich.indexOf('helper.')
  assert.ok(firstHelper > enrich.indexOf("if(step==='enriching'||blocked)return"))
  assert.ok(firstHelper > enrich.indexOf('focusField(\'surface\')return'))
})

test('[직접 입력하기] — 무조건 도우미 요청을 취소하고 닫는다(함정 ③) · 두 취소 호출은 이 둘뿐', () => {
  const add = squash('vocab/WordAddSheet.tsx')
  assert.match(add, /helper\.cancelPending\(\)helper\.close\(\)mic\.close\(\)setFromDraft\(false\)/)
  assert.equal(count(add, /helper\.cancelPending\(\)/g), 2)
  assert.equal(count(add, /helper\.close\(\)/g), 4) // enrich · 직접 입력하기 · 말로 쓰기 새로 열림(렌더 비교) · closeToButton
})

test('넣기 — 확인 안내 거둠 → 표현 칸 바꿈 → 판 닫기 → 초점, 이 경로에 뜻 채우기·요청·저장이 없다(D5, 함정 ⑨)', () => {
  const add = squash('vocab/WordAddSheet.tsx')
  const fill = between(add, 'constfillFromHelper=', 'return(<Sheet')
  assert.match(fill, /^constfillFromHelper=\(ja:string\)=>fillSurfaceFromHelper\(\{ja,edited:mic\.edited,setSurface:\(v\)=>set\('surface',v\),fill:helper\.fill,focusSurface:\(\)=>surfaceRef\.current\?\.focus\(\),\}\)/)
  assert.doesNotMatch(fill.slice(0, fill.indexOf('}),') + 3 || 400), /enrich\(|apiPost|save\(|onSaved|submit/)
  const logic = squash('vocab/wordHelperLogic.ts')
  const fn = logic.slice(logic.indexOf('exportfunctionfillSurfaceFromHelper'))
  assert.match(fn, /d\.edited\('surface'\)d\.setSurface\(d\.ja\)d\.fill\(d\.ja\)d\.focusSurface\(\)\}$/)
  assert.doesNotMatch(fn, /enrich|apiPost|save|submit|fetch/)
})

test('서로 닫기 — 가あ 로 열 때는 표현 칸에 말로 쓰기가 열려 있을 때만 닫고(073 안내 보존), 말로 쓰기가 새로 열림은 렌더 중 이전 값 비교로 본다(함정 ④⑨)', () => {
  const add = squash('vocab/WordAddSheet.tsx')
  assert.match(add, /consttoggleHelper=\(\)=>\{setTipOpen\(false\)if\(helper\.toggle\(\)&&mic\.target==='surface'\)mic\.close\('surface'\)\}/)
  assert.equal(count(add, /mic\.close\('surface'\)/g), 1, "무조건 mic.close('surface') 금지 — 닫혀 있어도 그 칸의 확인 안내를 지운다")
  assert.match(add, /const\[seenMicTarget,setSeenMicTarget\]=useState\(mic\.target\)if\(mic\.target!==seenMicTarget\)\{setSeenMicTarget\(mic\.target\)if\(micOpenedNow\(seenMicTarget,mic\.target\)&&helper\.open\)helper\.close\(\)\}/)
  // 토글 처리기를 감싸지 않는다(마이크가 막혀 열리지 않은 토글에 반응하면 안 된다) — 효과는 셋뿐(표현 칸 초점·요청 취소·처음 안내)
  assert.equal(count(add, /useEffect\(/g), 3)
  assert.doesNotMatch(add, /mic\.toggle/)
})

test('닫는 길이 하나 — ✕·Esc·가あ 가 같은 초점 복귀를 쓴다(패널은 closeToButton, 가あ 는 이미 거기에 초점)', () => {
  const add = squash('vocab/WordAddSheet.tsx')
  assert.match(add, /constcloseToButton=\(\)=>\{helper\.close\(\)helperBtnRef\.current\?\.focus\(\)\}/)
  const panel = squash('vocab/WordPhraseHelper.tsx')
  assert.match(panel, /onKeyDown=\{panelEscapeKeyDown\(onClose\)\}/)
  assert.match(panel, /aria-label=\{WORD_HELPER\.close\}onPointerDown=\{keepInputFocus\}onClick=\{onClose\}/)
})

test('처음 안내 — 회화방과 같은 플래그(claimHelperTip)를 ref 가드로 한 번만 쓰고, 새 저장 키가 없다(D6)', () => {
  const add = squash('vocab/WordAddSheet.tsx')
  assert.match(add, /import\{claimHelperTip\}from'@\/components\/talk\/phraseHelperLogic'/)
  assert.match(add, /useEffect\(\(\)=>\{if\(tipClaimRef\.current!==null\)returntipClaimRef\.current=claimHelperTip\(\)if\(tipClaimRef\.current\)setTipOpen\(true\)\},\[\]\)/)
  assert.equal(count(add, /claimHelperTip\(\)/g), 1)
  assert.match(add, /consttipShown=wordHelperTipShown\(\{tipOpen,step,helperOpen:helper\.open,micTarget:mic\.target\}\)/)
  for (const f of NEW_FILES) assert.doesNotMatch(code(f), /helperTipSeen|kaiwa\.talk|kaiwa\./, `${f}: 새 저장 키 금지`)
})

test('요청 — 경로 /api/v1/words/phrase-help, 본문은 queryKo 하나, 실패는 요청 래퍼가 단어 규칙으로 먼저 분류, 수명주기는 회화방 컨트롤러', () => {
  const raw = code('vocab/useWordPhraseHelper.ts')
  const hook = squash('vocab/useWordPhraseHelper.ts')
  assert.match(raw, /const PATH = '\/api\/v1\/words\/phrase-help'/)
  assert.equal(count(hook, /apiPost</g), 1)
  assert.match(hook, /apiPost<unknown>\(PATH,\{queryKo:q\.trim\(\)\},\{signal\}\)/)
  assert.match(hook, /\.catch\(\(e:unknown\)=>\{if\(!isAbort\(e\)\)failure=wordHelperFailureOf\(toErr\(e\),false\)throwe\}\)/)
  assert.match(hook, /settle:\(r:HelperSettle\)=>apply\(wordHelperOutcomeOf\(r,failure\)\)/)
  assert.match(hook, /const\[req\]=useState\(createHelperRequester\)/)
  assert.match(hook, /useEffect\(\(\)=>\(\)=>req\.dispose\(\),\[req\]\)/)
  assert.doesNotMatch(raw, /\b(mode|scene|chatId)\b\s*[:,}]/, '본문에 mode·scene 없음')
  assert.doesNotMatch(raw, /setTimeout|setInterval|new AbortController/, '타이머·취소는 컨트롤러가 맡는다')
  // 회화방 판의 훅/패널을 쓰지 않는다(채팅방 전제 — id·h2·문구·스크롤 규칙이 섞인다)
  for (const f of NEW_FILES) assert.doesNotMatch(code(f), /usePhraseHelper|PhraseHelperPanel|PhraseHelperHead|PhraseHelperTip|PhraseHelperCard|helperFailureOf/, `${f}: 회화방 부품 재사용 금지`)
})

test('도우미 파일 — 저장소·콘솔·직접 fetch/Capacitor·엔진/모델 이름·공용 Skeleton·가이드 밖 talk import 가 없다(함정 ⑦⑧⑫)', () => {
  const allowed = new Set([
    'HELPER', 'HELPER_COUNT_FROM', 'HELPER_MAX', 'HELPER_PANEL_ID', 'PhraseHelperButton', 'claimHelperTip', 'createHelperRequester', 'askBlockOf', 'isImeEnter', 'keepInputFocus',
    'AskBlock', 'HelperMsg', 'HelperSettle',
  ])
  for (const f of NEW_FILES) {
    const src = code(f)
    assert.doesNotMatch(src, /localStorage|sessionStorage|console\.|\bfetch\(|window\.Capacitor|\bspawn\b/, `${f}: 금지 호출`)
    assert.doesNotMatch(src, /reazon|whisper|style-?bert|claude|haiku|sonnet|opus|qwen|sherpa|speaker_?id|model_?id/i, `${f}: 엔진·모델 이름`)
    assert.doesNotMatch(src, /Skeleton|challenge\/parts/, `${f}: 공용 Skeleton`)
    for (const m of src.matchAll(/import\s+(?:type\s+)?([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*'@\/components\/talk\/([^']+)'/g)) {
      const names = [m[1], ...(m[2] ?? '').split(',')].map((n) => n?.replace(/^\s*type\s+/, '').trim()).filter(Boolean)
      for (const n of names) assert.ok(allowed.has(n), `${f}: talk 에서 가이드 밖 이름을 가져옴 — ${n} (${m[3]})`)
    }
    assert.doesNotMatch(src, /from '@\/components\/talk\/(?:TalkRoom|usePhraseHelper|PhraseHelperPanel|PhraseHelperCard|PhraseHelperTip)/)
  }
})

test('패널 소스 — <form 없음 · 모든 버튼 type="button" · Enter 는 helperQueryKeyDown · 보낸 뒤 초점은 blur 가 아니라 [물어보기] · 열 때 초점은 마운트 때 한 번(함정 ①⑥)', () => {
  const raw = code('vocab/WordPhraseHelper.tsx')
  assert.doesNotMatch(raw, /<form/)
  assert.equal(count(raw, /<button\b/g), count(raw, /<button\b[^>]*?type="button"/g), '모든 <button 에 type="button"')
  assert.doesNotMatch(raw, /type="submit"/)
  assert.doesNotMatch(raw, /\.blur\(/)
  assert.match(raw, /askRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(raw, /onKeyDown=\{\(e\) => helperQueryKeyDown\(\(\) => askNow\(\)\)\(e\)\}/)
  assert.doesNotMatch(raw, /(?<![\w-])disabled\b/, '질의 칸·버튼에 disabled 를 쓰지 않는다(aria-disabled 만)')
  assert.doesNotMatch(raw, /data-kb-docked|overflow-y-auto|max-h-|\[:root\[data-kb\]/, '회화방 판의 스크롤·키보드 숨김을 베끼지 않는다')
  const sq = squash('vocab/WordPhraseHelper.tsx')
  assert.match(sq, /constfocusOnOpenRef=useRef\(h\.fresh\)useLayoutEffect\(\(\)=>\{if\(focusOnOpenRef\.current\)qRef\.current\?\.focus\(\)\},\[qRef\]\)/)
  assert.match(sq, /id=\{HELPER_PANEL_ID\}/)
  // [그만두기]·[다시 시도] 도 보낸/멈춘 뒤 초점을 [물어보기]로(그 버튼이 사라지므로)
  assert.match(sq, /onClick=\{\(\)=>sentFocus\(h\.stop\(\)\)\}/)
  assert.match(sq, /sentFocus\(h\.retry\(\)\)/)
})

test('후보 읽기 — 훅은 ja·ko 만 남기는 wordHelperApply 를 거치고, 카드 props 타입에 꼬리표·이유 칸이 없다(L-4)', () => {
  const hook = squash('vocab/useWordPhraseHelper.ts')
  assert.match(hook, /consta=wordHelperApply\(o\)/)
  assert.match(hook, /if\(a\.items\)setItems\(a\.items\)/)
  const card = squash('vocab/WordHelperCard.tsx')
  assert.match(card, /item:WordPhraseHelpItem/)
  assert.doesNotMatch(card, /labelKo|whyKo|Badge|JaQuoted/)
})

test('공용 Sheet(Q1=A) — Esc 는 defaultPrevented 가 아닐 때만 닫는다: 소스 한 줄 고정 + 그 처리기를 가짜 이벤트로 실행', () => {
  const sheet = code('common/Sheet.tsx')
  assert.equal(count(sheet, /Escape/g), 1, 'Esc 처리는 한 곳')
  assert.ok(sheet.includes("if (e.key === 'Escape' && !e.defaultPrevented) onClose()"))
  const m = sheet.match(/const onKey = \(e: KeyboardEvent\) => \{([\s\S]*?)\n\s*\}\n/)
  assert.ok(m, 'onKey 처리기')
  const run = new Function('e', 'onClose', m[1]) as (e: { key: string; defaultPrevented: boolean }, onClose: () => void) => void
  const closes = (e: { key: string; defaultPrevented: boolean }) => {
    let n = 0
    run(e, () => {
      n += 1
    })
    return n
  }
  assert.equal(closes({ key: 'Escape', defaultPrevented: false }), 1, '안쪽이 처리하지 않은 Esc 는 지금처럼 시트를 닫는다')
  assert.equal(closes({ key: 'Escape', defaultPrevented: true }), 0, '안쪽이 처리한 Esc(도우미 판·가あ·녹음 취소)는 시트를 닫지 않는다')
  assert.equal(closes({ key: 'Enter', defaultPrevented: false }), 0)
  assert.equal(closes({ key: 'Enter', defaultPrevented: true }), 0)
  // 닫히지 않는 시트(제출 중)는 리스너 자체를 달지 않는다 — 기존 규칙 그대로
  assert.match(sheet, /if \(!open \|\| !dismissible\) return\n\s*const onKey/)
})

test('WordMicField — 슬롯 두 개는 선택이고 라벨 줄에서만 쓰인다(예문 칸·폼·수정 시트는 넘기지 않는다)', () => {
  const field = squash('vocab/WordMicField.tsx')
  assert.match(field, /trailing\?:React\.ReactNode/)
  assert.match(field, /afterLabel\?:React\.ReactNode/)
  assert.match(field, /\{trailing\?<divclassName="flexflex-noneitems-centergap-2">\{toggle\}\{trailing\}<\/div>:toggle\}<\/div>\{afterLabel\}\{why\?/)
  assert.equal(count(code('vocab/WordForm.tsx'), /trailing=|afterLabel=/g), 0)
  assert.equal(count(code('vocab/WordAddSheet.tsx'), /trailing=/g), 1)
})
