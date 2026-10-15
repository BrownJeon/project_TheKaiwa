/**
 * task-069 — 말로 쓰기 화면 배선: 표현·예문 칸에만 붙고(읽기·뜻·분류 등 한국어 칸과 수정 시트에는 없음), 막힌 환경에서도 키보드 입력이 남고,
 * 점검 용도(MIC_TEST)·저장 금지·자동 저장 금지가 소스에서 지켜진다. 공용 `Sheet` 가 포털이라 시트 배선은 소스 스캔으로 본다(실제 녹음은 QA·실기기).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyForm } from '../validate'
import type { WordMic } from '../wordMic'
import WordForm from '../WordForm'
import WordMicField from '../WordMicField'

const noop = () => {}
const src = (f: string) => readFileSync(join(process.cwd(), 'src/components/vocab', f), 'utf8')

function fakeMic(over: Partial<WordMic> = {}): WordMic {
  return {
    target: null,
    blocked: null,
    announce: null,
    toggle: noop,
    close: noop,
    dismissError: noop,
    voice: {
      phase: 'idle',
      recording: false,
      db: null,
      partial: '',
      statusText: '누르고 있는 동안 말해요',
      pttLabel: '누르고 있는 동안 말하기',
      error: null,
      press: noop,
      release: noop,
      abort: noop,
    },
    ...over,
  }
}

function field(mic: WordMic, target: 'surface' | 'example' = 'surface', value = '') {
  return renderToStaticMarkup(
    createElement(
      WordMicField,
      { mic, target, idPrefix: 'x', value, label: createElement('label', { htmlFor: `x_${target}` }, '표현') } as ComponentProps<typeof WordMicField>,
      createElement('input', { id: `x_${target}` }),
    ),
  )
}

const form = (mic: WordMic | undefined, expandExtras: boolean) =>
  renderToStaticMarkup(
    createElement(WordForm, {
      values: emptyForm('映画'),
      errors: {},
      onChange: noop,
      categories: [],
      expandExtras,
      onToggleExtras: noop,
      idPrefix: 'wadd',
      ...(mic ? { mic } : {}),
    }),
  )

const toggles = (html: string) => [...html.matchAll(/aria-label="([^"]*말로 쓰기)"/g)].map((m) => m[1])

test('닫힌 칸 — 「말로 쓰기」 버튼이 있고 입력 칸은 그대로 있다', () => {
  const html = field(fakeMic())
  assert.match(html, /aria-label="표현 말로 쓰기"/)
  assert.match(html, /id="x_surface"/)
  assert.doesNotMatch(html, /누르고 있는 동안 말하기/)
  assert.doesNotMatch(html, /aria-disabled/)
  assert.match(html, /h-11/)
})

test('열린 칸 — 입력 칸 자리에 누르고 말하기(72px)가 오고 글자로 돌아가는 버튼이 된다', () => {
  const html = field(fakeMic({ target: 'surface' }), 'surface', '映画')
  assert.match(html, /aria-label="표현 글자로 쓰기"/)
  assert.match(html, /aria-label="누르고 있는 동안 말하기"/)
  assert.match(html, /h-\[72px\]/)
  assert.doesNotMatch(html, /id="x_surface"/)
  assert.match(html, /일본어로 말하면 표현이 바뀌어요/)
  assert.match(html, /映画/)
  const ex = field(fakeMic({ target: 'example' }), 'example')
  assert.match(ex, /예문 끝에 이어 붙어요/)
  assert.match(ex, /여기에 알아들은 말이 나와요/)
})

test('다른 칸이 열려 있으면 이 칸은 입력 칸 그대로', () => {
  const html = field(fakeMic({ target: 'example' }), 'surface')
  assert.match(html, /aria-label="표현 말로 쓰기"/)
  assert.match(html, /id="x_surface"/)
})

test('막힌 환경 — 버튼은 숨기지 않고 막은 채 이유 한 줄, 키보드 입력은 그대로', () => {
  const html = field(fakeMic({ blocked: 'INSECURE' }))
  assert.match(html, /aria-label="표현 말로 쓰기"/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /aria-describedby="x_surface_mic_why"/)
  assert.match(html, /이 주소에서는 마이크를 쓸 수 없어요\./)
  assert.match(html, /id="x_surface"/)
  const denied = field(fakeMic({ blocked: 'MIC_DENIED' }))
  assert.match(denied, /마이크 사용이 막혀 있어요\./)
  assert.match(denied, /허용/)
})

test('이미 열린 칸은 막혀도 글자로 돌아갈 수 있다', () => {
  const html = field(fakeMic({ target: 'surface', blocked: 'OFFLINE' }))
  assert.doesNotMatch(html, /aria-disabled/)
  assert.doesNotMatch(html, /인터넷에 연결되어 있지 않아요/)
})

test('열린 칸 안의 오류는 기존 오류 띠로 보인다', () => {
  const html = field(fakeMic({ target: 'surface', voice: { ...fakeMic().voice, error: { code: 'CONNECT_FAILED' } } }))
  assert.match(html, /role="alert"/)
  assert.match(html, /음성 인식 서버에 연결하지 못했어요\./)
  assert.match(html, /글자로 쓰기/)
})

test('방금 넣은 말은 화면 읽기용 영역으로 알린다(그 칸만)', () => {
  const html = field(fakeMic({ announce: { target: 'surface', text: '映画', n: 1 } }))
  assert.match(html, /role="status"[^>]*>알아들은 말: 映画</)
  assert.doesNotMatch(field(fakeMic({ announce: { target: 'example', text: '散歩', n: 1 } }), 'surface'), /알아들은 말: /)
})

test('화면 문구에 엔진·모델 이름이 없다', () => {
  const html = [field(fakeMic({ target: 'surface' })), field(fakeMic({ blocked: 'SERVER_UNAVAILABLE' })), form(fakeMic(), true)].join('')
  assert.doesNotMatch(html, /reazon|whisper|style-?bert|claude|sherpa|speaker_?id|model_?id/i)
})

test('폼 — 표현·예문 칸에만 붙고 읽기·뜻·예문 뜻·메모·분류에는 없다', () => {
  assert.deepEqual(toggles(form(fakeMic(), true)), ['표현 말로 쓰기', '예문 말로 쓰기'])
  assert.deepEqual(toggles(form(fakeMic(), false)), ['표현 말로 쓰기'])
})

test('수정 시트처럼 mic 를 주지 않으면 마이크가 없고 입력 칸 DOM 은 그대로', () => {
  const plain = form(undefined, true)
  assert.doesNotMatch(plain, /말로 쓰기|글자로 쓰기|누르고 있는 동안/)
  assert.match(plain, /id="wadd_surface"/)
  assert.match(plain, /id="wadd_example"/)
  assert.doesNotMatch(plain, /role="status"/)
})

test('수정 시트는 마이크를 가져오지 않는다', () => {
  const detail = src('WordDetailSheet.tsx')
  assert.doesNotMatch(detail, /useWordMic|WordMicField|wordMic|\bmic=/)
})

test('추가 시트 배선 — 훅 하나, 폼에 mic 를 넘기고, 결과는 칸에 채우기만 한다', () => {
  const add = src('WordAddSheet.tsx')
  assert.equal(add.match(/useWordMic\(/g)?.length, 1)
  assert.equal(add.match(/\bmic=\{mic\}/g)?.length, 2) // 1단계 표현 칸 + 폼
  const block = add.slice(add.indexOf('useWordMic({'), add.indexOf('const focusField'))
  assert.match(block, /applyMicToForm\(/)
  assert.doesNotMatch(block, /enrich\(|save\(|apiPost|onSaved/)
  // 단계가 바뀌거나 칸이 사라지면 닫는다
  assert.match(add, /mic\.close\(\)\s*\n\s*abortRef\.current\?\.abort\(\)/)
  assert.match(add, /mic\.close\('example'\)/)
  assert.match(add, /mic\.close\(f\)/)
})

// ── 훅·시트 배선 고정(REV069-1) — DOM 이 없어 실제 실행은 못 하므로, 주석과 공백을 모두 지운 소스에서 「동작 의미가 있는 호출」이 제자리에 있는지 본다.
// 호출이 빠지거나 인자가 바뀌면 실패한다. 규칙 자체(무엇을 반환하는가)는 wordMic.test.ts 의 순수 함수 시험이 지킨다.
const squash = (f: string) =>
  src(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '')
/** squash 한 소스에서 두 표지 사이(앞 표지 포함). 표지를 못 찾으면 실패 — 파일이 바뀌면 이 시험도 같이 고친다. */
function between(code: string, from: string, to: string): string {
  const a = code.indexOf(from)
  const b = code.indexOf(to, a + from.length)
  assert.ok(a >= 0 && b > a, `표지를 찾지 못함: ${from} … ${to}`)
  return code.slice(a, b)
}

test('훅 — 누르면 누른 칸을 기록하고(R8), 결과가 칸에 들어가면 닫으며(R7), 지금 칸과 비교한다(R4)', () => {
  const hook = squash('useWordMic.ts')
  const press = between(hook, 'constpress=useCallback', 'const{committed')
  assert.match(press, /refs\.current=micPress\(refs\.current\)setHint\(null\)sttPress\(\)/)
  const onFinal = between(hook, 'constonFinal=useCallback', 'conststt=useRealtimeStt')
  assert.match(onFinal, /const\{action,refs:next\}=micFinalStep\(refs\.current,f\.text\)/)
  assert.match(onFinal, /if\(action\.kind==='ignore'\)return/)
  assert.match(onFinal, /refs\.current=nextsetTarget\(next\.target\)/)
  assert.match(onFinal, /optsRef\.current\.onResult\(action\.target,action\.text\)/)
})

test('훅 — 칸이 바뀔 때(열기·옮기기·닫기) 그때 보이던 오류를 넘겨 다음 칸에 새지 않게 한다(REV069-4)', () => {
  const hook = squash('useWordMic.ts')
  const retarget = between(hook, 'constretarget=useCallback', 'consttoggle=useCallback')
  assert.match(retarget, /if\(step\.abort\)sttAbort\(\)/)
  assert.match(retarget, /if\(step\.target===prev\)returnfalse/)
  assert.match(retarget, /refs\.current=\{\.\.\.refs\.current,target:step\.target\}setTarget\(step\.target\)/)
  assert.match(retarget, /setDismissed\(\(d\)=>dismissedAfterRetarget\(prev,step\.target,error,d\)\)/)
  assert.match(between(hook, 'consttoggle=useCallback', 'constclose=useCallback'), /retarget\(micToggle\(refs\.current\.target,t,blocked!==null\)\)/)
  assert.match(between(hook, 'constclose=useCallback', 'constpress=useCallback'), /retarget\(micClose\(refs\.current\.target,only\)\)/)
  assert.match(hook, /error:visibleMicError\(error,dismissed\)/)
})

test('추가 시트 — 인식 결과는 폼의 지금 값에 합쳐 칸에 넣고(R3), 한도를 넘으면 검증 문구를 바로 올린다(R9)', () => {
  const add = squash('WordAddSheet.tsx')
  const onResult = between(add, 'onResult:', 'constfocusField')
  assert.match(onResult, /constr=applyMicToForm\(form,target,text\)if\(r===null\)return/)
  assert.match(onResult, /set\(target,r\.value\)/)
  assert.match(onResult, /constover=r\.errorif\(over\)setErrors\(\(e\)=>\(\{\.\.\.e,\[target\]:over\}\)\)/)
})

test('추가 시트 — 단계가 바뀌거나 칸이 사라지는 곳마다 말로 쓰기를 닫는다(R1·R2)', () => {
  const add = squash('WordAddSheet.tsx')
  // 뜻 채우기: 검증을 통과한 뒤 요청을 시작하기 전에
  const enrich = between(add, 'constenrich=async', 'conststopEnrich')
  assert.match(enrich, /return\}mic\.close\(\)abortRef\.current\?\.abort\(\)/)
  // 저장: 검증을 통과한 뒤 제출 상태로 넘어가기 전에(R1)
  const save = between(add, 'constsave=async', 'constsurfaceEmpty')
  assert.match(save, /if\(first\)\{setErrors\(errs\)focusField\(first\)return\}mic\.close\(\)setSubmitting\(true\)/)
  // 직접 입력하기(R2) · 예문 접기
  assert.match(add, /mic\.close\(\)setFromDraft\(false\)/)
  assert.match(add, /mic\.close\('example'\)setExtras/)
  // 오류 포커스가 갈 칸은 글자로 돌린 뒤 포커스
  assert.match(between(add, 'constfocusField', 'constenrich'), /if\(f==='surface'\|\|f==='example'\)mic\.close\(f\)setTimeout/)
  assert.ok((add.match(/mic\.close\(/g) ?? []).length >= 5, 'mic.close 호출이 5곳 미만')
})

test('추가 시트 — 1단계에서 빈 표현 오류가 나도 입력 칸이 그려진 뒤 포커스한다(REV069-3)', () => {
  const add = squash('WordAddSheet.tsx')
  const enrich = between(add, 'constenrich=async', 'conststopEnrich')
  assert.match(enrich, /setErrors\(\{surface:bad\}\)focusField\('surface'\)return/)
  // 말로 쓰는 중에는 입력 칸이 DOM 에 없어 ref 로 바로 포커스하면 null 이다.
  assert.doesNotMatch(enrich, /surfaceRef\.current/)
})

test('전환 버튼 — 결과가 들어가거나 오류 띠에서 글자로 돌아가면 포커스를 이 버튼으로 옮긴다(REV069-2)', () => {
  const f = squash('WordMicField.tsx')
  assert.match(f, /<buttonref=\{toggleRef\}type="button"/)
  assert.match(f, /constseenN=useRef\(announce\?\.n\?\?null\)/)
  assert.match(f, /if\(!micResultFocus\(seenN\.current,announce\)\)returnseenN\.current=announce\?\.n\?\?nulltoggleRef\.current\?\.focus\(\)\},\[announce\]\)/)
  assert.match(f, /mic\.close\(target\)toggleRef\.current\?\.focus\(\)/)
})

test('점검 용도(MIC_TEST)만 — 대화 id·TURN·저장·로그 경로가 없다', () => {
  const hook = src('useWordMic.ts')
  assert.match(hook, /purpose: 'MIC_TEST'/)
  assert.doesNotMatch(hook, /'TURN'|chatId|utteranceId/)
  for (const f of ['useWordMic.ts', 'WordMicField.tsx', 'wordMic.ts']) {
    const code = src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.doesNotMatch(code, /\bfetch\(|apiPost|apiGet|localStorage|sessionStorage|console\.|spawn|window\.Capacitor/, f)
    assert.doesNotMatch(code, /reazon|whisper|style-?bert|claude|sherpa/i, f)
  }
})
