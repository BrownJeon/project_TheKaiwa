/**
 * task-039(IMP-0025) — A3(표현 점검 `buildChatReviewRequest`)·A4(레슨 `buildLessonRequest`)의 **설명 문체**(일상 회화 중심 vs JLPT 식)를 head(HEAD 프롬프트·HEAD tutor.md)와
 * work(작업본)로 재는 실 Claude CLI(구독) 실측. **운영 DB 를 바꾸지 않는다**(합성 입력만 — `chat-review-style.json`·`lesson.json`, connection 은 읽기만).
 * 방식은 `task039-explain-ab.ts` 와 같다(HEAD 복원 src 동적 import + `TUTOR_PERSONA_PATH` 로 HEAD persona, 팔 교차·순차·호출 간격). 규칙 판정은 `task039-style-classify.ts`.
 * chatReview@v3(pe-039c) — A3 항목의 추가 설명 칸 `extra_note_ko` 도 기록한다(키 존재·채움·서버 정리 통과·길이·문장 종류별·설명의 '조각' 언급). `ARMS=head,work` 의 head 를 HEAD 가 아니라 직전 버전(v2) 복사본으로 두려면
 * `BASE_SRC=~/.node-local/thekaiwa-v2-039/src BASE_PERSONA=~/.node-local/thekaiwa-v2-039/tutor.md` 로 덮는다. 실패(타임아웃 포함)는 분모에서 빼지 않고 따로 센다.
 *
 * 실행(우분투 개발 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/task039-review-lesson-ab.ts
 * 환경변수: SETS=review,lesson  RUNS_REVIEW=3  RUNS_TOPIC=3  RUNS_SOURCE=2  ARMS=head,work  GAP_MS=1500  OUT=/tmp/kaiwa-task039-rl.json
 *       SUMMARIZE_ONLY=a.json,b.json  DUMP=1  BASE_SRC=…  BASE_PERSONA=…
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { llm } from '../../src/modules/engine'
import { checkLessonResponse, type ChatReviewResponse, type LessonResponse, type LessonTopicInput } from '../../src/modules/conversation'
import * as WORK_R from '../../src/modules/conversation/prompts/chatReview'
import * as WORK_L from '../../src/modules/conversation/prompts/lesson'
import { sanitizeExtraNoteKo } from '../../src/modules/conversation/structuredResponse/checks'
import { flagsOf } from './task039-style-classify'

type Arm = 'head' | 'work'
const ARMS = (process.env.ARMS ?? 'head,work').split(',').map((s) => s.trim()) as Arm[]
const SETS = (process.env.SETS ?? 'review,lesson').split(',').map((s) => s.trim())
const RUNS_REVIEW = Number(process.env.RUNS_REVIEW ?? 3)
const RUNS_TOPIC = Number(process.env.RUNS_TOPIC ?? 3)
const RUNS_SOURCE = Number(process.env.RUNS_SOURCE ?? 2)
const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const OUT = process.env.OUT ?? '/tmp/kaiwa-task039-rl.json'
const SUMMARIZE_ONLY = process.env.SUMMARIZE_ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const BASE_SRC = process.env.BASE_SRC ?? join(process.env.HOME ?? '', '.node-local/thekaiwa-head039/src')
const BASE_PERSONA = process.env.BASE_PERSONA ?? join(process.env.HOME ?? '', '.node-local/thekaiwa-head039/tutor.md')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const review = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/chat-review-style.json'), 'utf8')) as { level: string; messages: { id: string; text: string; kind: 'DAILY' | 'EXAM' | null }[] }
const lessonFx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as {
  topic: LessonTopicInput
  sourceText: string
  acceptedCorrections: { original: string; corrected: string }[]
  previousTitles: string[]
  previousNextPreview: { titleKo: string; teaserKo: string }
}
const learner = { displayName: '브라운', teacherName: '유우', level: review.level, weaknesses: ['PARTICLE(4)', 'CONJUGATION(2)'], streakDays: 6 }

interface Builders {
  buildChatReviewRequest: (i: Record<string, unknown>) => Parameters<typeof llm.completeJson<ChatReviewResponse>>[0]
  buildLessonRequest: (i: Record<string, unknown>) => Parameters<typeof llm.completeJson<LessonResponse>>[0] & { allowedChunkIds: string[] }
  CHAT_REVIEW_PROMPT_VERSION?: string
  LESSON_PROMPT_VERSION?: string
}
let HEAD: Builders
const WORK: Builders = {
  buildChatReviewRequest: WORK_R.buildChatReviewRequest as unknown as Builders['buildChatReviewRequest'],
  buildLessonRequest: WORK_L.buildLessonRequest as unknown as Builders['buildLessonRequest'],
  CHAT_REVIEW_PROMPT_VERSION: WORK_R.CHAT_REVIEW_PROMPT_VERSION,
  LESSON_PROMPT_VERSION: (WORK_L as { LESSON_PROMPT_VERSION?: string }).LESSON_PROMPT_VERSION,
}

interface Row {
  set: 'review' | 'lesson'
  arm: Arm
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  promptChars?: number
  personaChars?: number
  resultChars?: number
  violations?: number
  /** review: 항목별 {id, kind, explanation_ko}. */
  items?: { id: string; kind: string | null; text: string; hasKey: boolean; extra: string | null; extraClean: string | null }[]
  /** lesson: grammar 별 {pattern, explanationKo}. */
  grammar?: { pattern: string; text: string }[]
  error?: string
}

function withPersona<T>(arm: Arm, f: () => T): T {
  if (arm === 'head') process.env.TUTOR_PERSONA_PATH = BASE_PERSONA
  else delete process.env.TUTOR_PERSONA_PATH
  try {
    return f()
  } finally {
    delete process.env.TUTOR_PERSONA_PATH
  }
}

async function runReview(arm: Arm, n: number): Promise<Row> {
  const b = arm === 'head' ? HEAD : WORK
  const label = `review#${n}`
  const req = withPersona(arm, () => b.buildChatReviewRequest({ todayKst: '2026-10-06', learner, messages: review.messages.map((m) => ({ id: m.id, text: m.text })) }))
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ChatReviewResponse>({ ...req, timeoutMs: 90_000 })
    const kindOf = new Map(review.messages.map((m) => [m.id, m.kind]))
    return {
      set: 'review', arm, label, ok: true, ms: r.elapsedMs, attempts: r.attempts, promptChars: r.promptChars, personaChars: req.persona?.prompt.length, resultChars: JSON.stringify(r.data).length,
      items: r.data.items.map((it) => ({
        id: it.message_id,
        kind: kindOf.get(it.message_id) ?? null,
        text: it.explanation_ko,
        hasKey: Object.prototype.hasOwnProperty.call(it, 'extra_note_ko'),
        extra: typeof it.extra_note_ko === 'string' && it.extra_note_ko.trim() ? it.extra_note_ko : null,
        extraClean: sanitizeExtraNoteKo(it.explanation_ko, it.extra_note_ko),
      })),
    }
  } catch (e) {
    return { set: 'review', arm, label, ok: false, ms: Date.now() - t0, error: `${(e as Error).name}: ${(e as Error).message.slice(0, 250)}` }
  }
}

async function runLesson(arm: Arm, path: 'topic' | 'source', n: number): Promise<Row> {
  const b = arm === 'head' ? HEAD : WORK
  const label = `${path}#${n}`
  const base = { todayKst: '2026-10-06', learner: { ...learner, level: 'N4' }, acceptedCorrections: lessonFx.acceptedCorrections, previousTitles: lessonFx.previousTitles }
  const req = withPersona(arm, () => b.buildLessonRequest(path === 'topic' ? { ...base, topic: lessonFx.topic, previousNextPreview: lessonFx.previousNextPreview } : { ...base, sourceText: lessonFx.sourceText }))
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
    return {
      set: 'lesson', arm, label, ok: true, ms: r.elapsedMs, attempts: r.attempts, promptChars: r.promptChars, personaChars: req.persona?.prompt.length, resultChars: JSON.stringify(r.data).length,
      violations: checkLessonResponse({ allowedChunkIds: req.allowedChunkIds }, r.data).length,
      grammar: r.data.grammar.map((g) => ({ pattern: g.pattern, text: g.explanationKo })),
    }
  } catch (e) {
    return { set: 'lesson', arm, label, ok: false, ms: Date.now() - t0, error: `${(e as Error).name}: ${(e as Error).message.slice(0, 250)}` }
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const pctl = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)] : NaN)
const frac = (a: number, b: number) => (b ? `${a}/${b} (${((a / b) * 100).toFixed(0)}%)` : '-')

function summarize(rows: Row[]): string {
  const out: string[] = []
  for (const set of ['review', 'lesson'] as const) {
    const sub = rows.filter((r) => r.set === set)
    if (!sub.length) continue
    out.push(`\n### ${set === 'review' ? 'A3 표현 점검(chat-review-style 14건: 일상 6·시험식 6·정답 2)' : 'A4 레슨 문법 설명(grammar[].pattern·explanationKo)'}`)
    out.push('| arm | n | 성공 | 1차 통과 | ms p50 | ms 평균 | 결과 평균자 | persona 자 | prompt 자 | 항목 수 | 설명 JLPT식(강한 용어·급수) | 설명 일상표지 | 설명 약한 용어 | 평균자 |')
    out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const arm of ARMS) {
      const a = sub.filter((r) => r.arm === arm)
      if (!a.length) continue
      const ok = a.filter((r) => r.ok)
      const texts = ok.flatMap((r) => (set === 'review' ? r.items!.map((i) => i.text) : r.grammar!.map((g) => g.text)))
      const fl = texts.map((t) => flagsOf(t))
      out.push(
        `| ${arm} | ${a.length} | ${frac(ok.length, a.length)} | ${frac(ok.filter((r) => r.attempts === 1).length, a.length)} | ${pctl(ok.map((r) => r.ms), 0.5)} | ${mean(ok.map((r) => r.ms)).toFixed(0)} | ${mean(ok.map((r) => r.resultChars ?? 0)).toFixed(0)} | ${mean(ok.map((r) => r.personaChars ?? 0)).toFixed(0)} | ${mean(ok.map((r) => r.promptChars ?? 0)).toFixed(0)} | ${texts.length} | ${frac(fl.filter((f) => f.jlptStyle).length, fl.length)} | ${frac(fl.filter((f) => f.everyday && !f.jlptStyle).length, fl.length)} | ${frac(fl.filter((f) => f.weakTerm).length, fl.length)} | ${mean(texts.map((t) => t.length)).toFixed(0)} |`,
      )
      if (set === 'review') {
        for (const k of ['DAILY', 'EXAM']) {
          const its = ok.flatMap((r) => r.items!.filter((i) => i.kind === k))
          const f2 = its.map((i) => flagsOf(i.text))
          out.push(`  - ${arm}/${k}: 항목 ${its.length} · JLPT식 ${frac(f2.filter((f) => f.jlptStyle).length, f2.length)} · 일상표지 ${frac(f2.filter((f) => f.everyday && !f.jlptStyle).length, f2.length)}`)
        }
        const all = ok.flatMap((r) => r.items!)
        const chunkAny = all.filter((i) => /조각/.test(i.text)).length
        const chunkNamed = all.filter((i) => /(이름|액션|느낌|꾸밈)\s*조각/.test(i.text)).length
        out.push(`  - ${arm}/설명 '조각' 언급(/조각/) ${frac(chunkAny, all.length)} · '이름|액션|느낌|꾸밈 조각' ${frac(chunkNamed, all.length)}`)
        const lens = all.filter((i) => i.extra).map((i) => i.extra!.length).sort((x, y) => x - y)
        out.push(`  - ${arm}/extra_note_ko 키 존재 ${frac(all.filter((i) => i.hasKey).length, all.length)} · 비null(원값) ${frac(lens.length, all.length)} · 서버 정리 통과 ${frac(all.filter((i) => i.extraClean).length, all.length)} · 길이(비null) n=${lens.length} min ${lens[0] ?? '-'} p50 ${lens.length ? lens[Math.floor((lens.length - 1) / 2)] : '-'} max ${lens.at(-1) ?? '-'} · 권고 40 초과 ${lens.filter((n) => n > 40).length} · 200 초과 ${lens.filter((n) => n > 200).length}`)
        for (const k of ['DAILY', 'EXAM', null] as const) {
          const its = all.filter((i) => i.kind === k)
          out.push(`  - ${arm}/extra_note_ko 채움(${k ?? '정답'}): 원값 ${frac(its.filter((i) => i.extra).length, its.length)} · 서버 정리 후 ${frac(its.filter((i) => i.extraClean).length, its.length)}`)
        }
        const clean = ok.flatMap((r) => r.items!.filter((i) => i.kind === null))
        out.push(`  - ${arm}/정답 메시지 오탐 항목: ${clean.length}`)
      }
    }
    for (const r of sub.filter((x) => !x.ok)) out.push(`- 실패 ${r.arm}/${r.label}: ${r.error}`)
    for (const r of sub.filter((x) => x.ok && x.attempts === 2)) out.push(`- 재시도 ${r.arm}/${r.label}`)
  }
  return out.join('\n')
}

function dump(rows: Row[]): string {
  const out: string[] = []
  for (const r of rows.filter((x) => x.ok)) {
    if (r.set === 'review') for (const i of r.items!) out.push(`[${r.arm}] review/${r.label}/${i.id}(${i.kind ?? '정답'}) EXP: ${i.text}${i.hasKey ? ` || EXTRA: ${i.extra ?? 'null'}${i.extra && !i.extraClean ? ' (서버 정리에서 버려짐)' : ''}` : ''}`)
    else for (const g of r.grammar!) out.push(`[${r.arm}] lesson/${r.label} PATTERN: ${g.pattern} | EXP: ${g.text}`)
  }
  return out.join('\n')
}

async function main() {
  if (SUMMARIZE_ONLY) {
    const all = SUMMARIZE_ONLY.flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as { rows: Row[] }).rows)
    console.log(`## 합산 요약(${SUMMARIZE_ONLY.join(' + ')}, 행 ${all.length})\n${summarize(all)}`)
    if (process.env.DUMP) console.log(`\n## 출력 목록\n${dump(all)}`)
    return
  }
  const r = (await import(pathToFileURL(join(BASE_SRC, 'modules/conversation/prompts/chatReview.ts')).href)) as Builders
  const l = (await import(pathToFileURL(join(BASE_SRC, 'modules/conversation/prompts/lesson.ts')).href)) as Builders
  HEAD = { buildChatReviewRequest: r.buildChatReviewRequest, buildLessonRequest: l.buildLessonRequest, CHAT_REVIEW_PROMPT_VERSION: r.CHAT_REVIEW_PROMPT_VERSION, LESSON_PROMPT_VERSION: (l as Builders).LESSON_PROMPT_VERSION }
  const jobs: { kind: 'review' | 'topic' | 'source'; n: number }[] = []
  if (SETS.includes('review')) for (let n = 1; n <= RUNS_REVIEW; n++) jobs.push({ kind: 'review', n })
  if (SETS.includes('lesson')) {
    for (let n = 1; n <= RUNS_TOPIC; n++) jobs.push({ kind: 'topic', n })
    for (let n = 1; n <= RUNS_SOURCE; n++) jobs.push({ kind: 'source', n })
  }
  console.log(`task-039 A3/A4 실측 — head=${HEAD.CHAT_REVIEW_PROMPT_VERSION} work=${WORK.CHAT_REVIEW_PROMPT_VERSION} · 작업 ${jobs.length}개 × 팔 ${ARMS.length} = 호출 ${jobs.length * ARMS.length}`)
  const rows: Row[] = []
  const save = () => writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
  let fastFails = 0
  for (const j of jobs) {
    const order: Arm[] = (ARMS.length === 2 && j.n % 2 === 0 ? [...ARMS].reverse() : ARMS) as Arm[]
    for (const arm of order) {
      const row = j.kind === 'review' ? await runReview(arm, j.n) : await runLesson(arm, j.kind, j.n)
      rows.push(row)
      console.log(JSON.stringify({ set: row.set, arm: row.arm, label: row.label, ok: row.ok, ms: row.ms, att: row.attempts, err: row.error }))
      save()
      if (row.error && /429|rate.?limit|usage limit|한도/i.test(row.error)) {
        console.log('429/사용 한도 감지 — 중단')
        console.log(summarize(rows))
        return
      }
      // 구독 세션 한도에 걸리면 CLI 가 stdout 에 "You've hit your session limit" 만 쓰고 exit=1·stderr 없음으로 즉시(≈2s) 끝난다(pe-039c 에서 10건이 그렇게 실패했다) — 위 정규식이 못 잡으므로 즉시 실패 2연속이면 중단.
      fastFails = !row.ok && /ClaudeCliExecError/.test(row.error ?? '') && row.ms < 5_000 ? fastFails + 1 : 0
      if (fastFails >= 2) {
        console.log('claude CLI 즉시 실패 2회 연속 — 구독 세션 한도 의심, 중단(이 실패 행은 프롬프트 결과가 아니다)')
        console.log(summarize(rows))
        return
      }
      await sleep(GAP_MS)
    }
  }
  console.log(`\n## 요약\n${summarize(rows)}`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
