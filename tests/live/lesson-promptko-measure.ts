/**
 * task-025 IMP-0014 — A4 v8(quiz.promptKo 필수·비어 있지 않은 한국어) 통과율 사전 측정.
 * Claude CLI 구독으로 A4(LESSON, `buildLessonRequest`)를 붙여넣기(sourceText)·주제·픽스처 sourceText 세 경로로
 * 반복 호출해, 같은 스크립트를 v7(변경 전) 코드와 v8(변경 후) 코드에서 각각 돌려 나란히 비교한다.
 * 운영 DB·3010 을 건드리지 않는다(결과는 stdout·`--out` 파일). `lesson-paste-diagnose.ts` 와 같은 원칙.
 *
 * 기록하는 것(회차별): 성공 여부·지연·attempts·프롬프트 자수·**quiz.promptKo 가 null/빈 문자열인 문항 수**·
 * 매 시도(1차·재시도)의 위반 목록(extraCheck 래핑)·1차 계약 위반 사유(`console.warn` 포획, 학습자 원문 없음).
 * v7 에서는 promptKo 가 null 인 문항이 몇 개나 나오는지가 곧 "폴백(q.promptKo ?? ja)에 기대던 비율"이다.
 *
 * **(e)=B 빈칸 문제 정답 노출 측정(2026-10-01)** — `--variant old` 는 같은 코드에서 지시문의 빈칸 구간만 (e)=B 이전 v8 초안 문구로 되돌려
 * (`req.system.replace`, 못 찾으면 중단) 돌리고, `--variant new`(기본)는 현재 코드 그대로 돌린다. 빈칸·밑줄형 문항(promptJa 에 ＿ 류 표지가 있거나
 * promptKo 에 "빈칸"·"밑줄")을 따로 모아 promptKo·promptJa·정답 선택지를 출력한다 — **정답 노출 건수는 사람이 이 표를 보고 센다**
 * (코드로는 판정하지 않는다: choices 에 한국어 뜻이 없다). 자동 표시는 `suspect`(promptKo 가 길거나 괄호·따옴표·말줄임이 있음) 뿐이며 육안 보조용이다.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/lesson-promptko-measure.ts
 *   [--runs-paste 3] [--runs-topic 3] [--runs-source 2] [--variant new|old] [--out /tmp/kaiwa-lesson-promptko-v7.json]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildLessonRequest, type LessonResponse, type LessonTopicInput } from '../../src/modules/conversation'

/** 운영 스모크(`tests/live/task010-smoke.ts`)와 바이트 단위로 같은 붙여넣기 입력. */
const PASTE_TEXT =
  '昨日、友達と新しいカフェに行きました。店員さんに「ご注文はお決まりですか」と聞かれて、少し緊張しました。私はホットコーヒーを、友達は抹茶ラテを注文しました。窓の外を見ながら、週末の旅行について話しました。とても楽しい時間でした。'

const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

interface Fixture {
  topic: LessonTopicInput
  sourceText: string
  acceptedCorrections: { original: string; corrected: string }[]
  previousTitles: string[]
  previousNextPreview: { titleKo: string; teaserKo: string }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as Fixture

const args = process.argv.slice(2)
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const runsPaste = Number(arg('--runs-paste', '3'))
const runsTopic = Number(arg('--runs-topic', '3'))
const runsSource = Number(arg('--runs-source', '2'))
const outFile = arg('--out', '/tmp/kaiwa-lesson-promptko-measure.json')
const variant = arg('--variant', 'new')
if (variant !== 'new' && variant !== 'old') throw new Error('--variant 는 new|old (new=현재 코드, old=(e)=B 이전 v8 초안)')

/**
 * quiz 지시 구간 — 현재 코드(NEW)와 (e)=B 이전 v8 초안(OLD). 양쪽 모두 `lesson.ts` quiz 줄의 해당 부분과 글자 단위로 같아야 한다.
 * 이력: (e)=B 첫 초안은 NEW 의 "정답이 되는 뜻·표현은 …" 일반 문장을 빈칸 절에 흡수해 지웠고(예산 때문), 재측정에서 뜻 고르기 문항의 promptKo 가
 * 일본어 문장 그대로(한글 없음)·정답 번역으로 나오는 회귀가 드러나 되살렸다(2026-10-01). 3차(tweak 3)는 "일본어 문장이 나오는 문제는 그 한국어 뜻을" 절을 지우고
 * "일본어 문장은 promptJa 에만"으로 바꿨다. 중간 판은 /tmp/kaiwa-e2~e6 결과로만 남는다.
 */
const KO_NOW = '한국어를 반드시 채웁니다**(null·빈 값 금지, 160자 이내) — 일본어 문장은 promptJa 에만 두고, promptKo 에는 무엇을 고르라는 한국어 지시(예: "문장의 뜻을 고르세요.")를 씁니다. '
const NEW_SEG = '정답이 되는 뜻·표현은 promptKo 에 미리 쓰지 않습니다. **빈칸 문제는 promptKo 에 할 일만 씁니다**(예: "빈칸에 들어갈 알맞은 말을 고르세요.") — 번역하지 않고, 빈 문장은 promptJa 에 ＿＿ 로 비워 반드시 채웁니다. '
const OLD_SEG = '(예: promptJa "コーヒーを ＿＿。" → promptKo "빈칸에 알맞은 말은? (커피를 ＿＿.)"). 정답이 되는 뜻·표현은 promptKo 에 미리 쓰지 않습니다. '
function applyVariant(req: ReturnType<typeof buildLessonRequest>): void {
  if (!req.system.includes(KO_NOW + NEW_SEG)) throw new Error('현재 lesson.ts 의 quiz 구간이 KO_NOW+NEW_SEG 와 다르다 — 스크립트의 문구를 갱신하라')
  if (variant === 'new') return
  // old: "…지시를 씁니다" 뒤에 옛 예시(OLD_SEG)가 붙는 (e)=B 이전 형태. ("그대로 "·"입니다"·"(다른 형식 금지)" 같은 단축은 되돌리지 않는다 — 비교에 영향 없음)
  req.system = req.system.replace(KO_NOW + NEW_SEG, '한국어 뜻을 반드시 채웁니다**(null·빈 값 금지, 160자 이내) — 일본어 문장이 나오는 문제는 그 한국어 뜻을, 뜻·형태를 고르는 문제는 무엇을 고르라는 지시를 씁니다' + OLD_SEG)
}
const BLANK_RE = /[＿_〇○□]|（\s*）|\(\s*\)/

interface AttemptRow {
  attempt: number
  violations: string[]
  quizPromptKoEmpty: number
  /** 이 시도에서 promptKo 에 한글이 없는 quiz 문항(진단용 — 생성물이며 학습자 원문 아님) */
  noHangulQuiz: { idx: number; promptKo: unknown; promptJa: unknown; choices: unknown }[]
}

interface RunRow {
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  promptChars?: number
  /** 최종 데이터의 quiz 문항 수 / promptKo 가 null·빈 문자열인 문항 수 / promptJa 가 null 인 문항 수 */
  quiz?: { total: number; promptKoEmpty: number; promptJaNull: number; koHasHangul: number }
  /** 빈칸·밑줄형 문항(promptJa 에 ＿ 류 표지 또는 promptKo 에 "빈칸"·"밑줄") 모음 — 정답 노출은 사람이 육안으로 센다 */
  blankQuiz?: { idx: number; promptKo: string; promptJa: string; answerChoice: string; jaHasBlank: boolean; suspect: boolean }[]
  /** application·speaking 의 promptKo 가 비어 있는 문항 수(이미 필수 — 참고용) */
  otherPromptKoEmpty?: number
  /** 품질 육안 점검용 — quiz 문항의 promptKo·promptJa·정답 선택지(학습자 원문 아님, 생성물) */
  quizSamples?: { promptKo: unknown; promptJa: unknown; answerChoice: string }[]
  firstAttemptWarn?: string
  finalError?: string
  /** CLI 자체가 모델에 닿기 전에 실패(구독 세션 한도 429·인증·네트워크 등) — 프롬프트 품질과 무관하므로 성공률 분모에서 뺀다 */
  infra?: boolean
  attemptDetail: AttemptRow[]
}

const HANGUL = /[가-힣]/

function quizStats(data: LessonResponse) {
  const quiz = data.quiz as { promptKo?: string | null; promptJa?: string | null }[]
  let promptKoEmpty = 0
  let promptJaNull = 0
  let koHasHangul = 0
  for (const q of quiz) {
    if (q.promptKo === null || q.promptKo === undefined || String(q.promptKo).trim() === '') promptKoEmpty++
    else if (HANGUL.test(String(q.promptKo))) koHasHangul++
    if (q.promptJa === null || q.promptJa === undefined) promptJaNull++
  }
  return { total: quiz.length, promptKoEmpty, promptJaNull, koHasHangul }
}

function blankStats(data: LessonResponse) {
  const quiz = data.quiz as { promptKo?: string | null; promptJa?: string | null; choices: string[]; answer: number }[]
  const rows: NonNullable<RunRow['blankQuiz']> = []
  quiz.forEach((q, i) => {
    const ko = String(q.promptKo ?? '')
    const ja = String(q.promptJa ?? '')
    const jaHasBlank = BLANK_RE.test(ja)
    if (!(jaHasBlank || ko.includes('빈칸') || ko.includes('밑줄'))) return
    const suspect = ko.length > 30 || /[()（）「」『』'"…]/.test(ko)
    rows.push({ idx: i + 1, promptKo: ko, promptJa: ja, answerChoice: q.choices[q.answer], jaHasBlank, suspect })
  })
  return rows
}

function otherEmpty(data: LessonResponse): number {
  const rows = [...(data.application as { promptKo?: string | null }[]), ...(data.speaking as { promptKo?: string | null }[])]
  return rows.filter((r) => r.promptKo === null || r.promptKo === undefined || String(r.promptKo).trim() === '').length
}

/** `req.extraCheck` 를 감싸 시도마다 위반·quiz.promptKo 공백 수를 기록한다 — 동작은 바꾸지 않는다(같은 함수 호출). */
function instrument(req: ReturnType<typeof buildLessonRequest>): AttemptRow[] {
  const rows: AttemptRow[] = []
  const original = req.extraCheck!
  let n = 0
  req.extraCheck = (data: LessonResponse, info?: Parameters<typeof original>[1]) => {
    n++
    const violations = original(data, info)
    const noHangulQuiz = (data.quiz as { promptKo?: unknown; promptJa?: unknown; choices?: unknown }[])
      .map((q, i) => ({ idx: i + 1, promptKo: q.promptKo, promptJa: q.promptJa, choices: q.choices }))
      .filter((q) => !HANGUL.test(String(q.promptKo ?? '')))
    rows.push({ attempt: n, violations, quizPromptKoEmpty: quizStats(data).promptKoEmpty, noHangulQuiz })
    return violations
  }
  return rows
}

async function run(label: string, req: ReturnType<typeof buildLessonRequest>): Promise<RunRow> {
  applyVariant(req)
  const attemptDetail = instrument(req)
  const warns: string[] = []
  const origWarn = console.warn
  console.warn = (...a: unknown[]) => {
    warns.push(a.map(String).join(' '))
    origWarn(...a)
  }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
    return {
      label, ok: true, ms: Date.now() - t0, attempts: r.attempts, promptChars: r.promptChars,
      quiz: quizStats(r.data), blankQuiz: blankStats(r.data), otherPromptKoEmpty: otherEmpty(r.data),
      quizSamples: (r.data.quiz as { promptKo?: unknown; promptJa?: unknown; choices: string[]; answer: number }[]).map((q) => ({
        promptKo: q.promptKo, promptJa: q.promptJa, answerChoice: q.choices[q.answer],
      })),
      firstAttemptWarn: warns.find((w) => w.includes('[json] 1차'))?.slice(0, 400), attemptDetail,
    }
  } catch (e) {
    const err = e as Error & { violations?: string[] }
    const ms = Date.now() - t0
    // CliExecError 가 응답 검증(extraCheck) 한 번 거치지 못하고 수 초 안에 끝났다면 모델 출력 문제가 아니다(2026-10-01 세션 한도 429 때 8회 중 6회가 이렇게 끝나 "성공 2/실패 6"으로 오집계됐다).
    const infra = err.name === 'ClaudeCliExecError' && attemptDetail.length === 0 && ms < 8_000
    return {
      label, ok: false, ms, infra,
      firstAttemptWarn: warns.find((w) => w.includes('[json] 1차'))?.slice(0, 400),
      finalError: `${err.name}: ${(err.violations ?? [err.message]).join(' / ').slice(0, 400)}`, attemptDetail,
    }
  } finally {
    console.warn = origWarn
  }
}

async function main() {
  console.log(`lesson(A4) quiz.promptKo 측정 — variant=${variant} · 붙여넣기 ${runsPaste}회 + 주제 ${runsTopic}회 + 픽스처 sourceText ${runsSource}회`)
  const rows: RunRow[] = []
  let aborted = false
  const push = async (label: string, req: ReturnType<typeof buildLessonRequest>) => {
    if (aborted) return
    const row = await run(label, req)
    rows.push(row)
    console.log(JSON.stringify(row))
    if (row.infra) {
      aborted = true
      console.log(`\n!! INFRA 실패 — claude CLI 가 모델에 닿지 못했다(${row.finalError}). 세션 한도(429)·인증을 확인하고 나중에 다시 돌린다. 이후 호출은 건너뛴다.`)
    }
  }
  for (let i = 1; i <= runsPaste; i++) {
    await push(`paste#${i}`, buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: PASTE_TEXT, acceptedCorrections: [], previousTitles: [] }))
  }
  for (let i = 1; i <= runsTopic; i++) {
    await push(
      `topic#${i}`,
      buildLessonRequest({
        todayKst: '2026-09-28', learner, topic: fixture.topic,
        acceptedCorrections: fixture.acceptedCorrections, previousTitles: fixture.previousTitles, previousNextPreview: fixture.previousNextPreview,
      }),
    )
  }
  for (let i = 1; i <= runsSource; i++) {
    await push(
      `fixtureSource#${i}`,
      buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: fixture.sourceText, acceptedCorrections: fixture.acceptedCorrections, previousTitles: fixture.previousTitles }),
    )
  }
  const ok = rows.filter((r) => r.ok)
  const infraN = rows.filter((r) => r.infra).length
  const valid = rows.length - infraN
  const retried = ok.filter((r) => r.attempts === 2).length
  const koEmpty = ok.reduce((s, r) => s + (r.quiz?.promptKoEmpty ?? 0), 0)
  const quizTotal = ok.reduce((s, r) => s + (r.quiz?.total ?? 0), 0)
  const avgMs = ok.length ? Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length) : 0
  console.log(`\n## 요약 — 유효 n=${valid} 성공=${ok.length} 실패=${valid - ok.length} 재시도(attempts=2)=${retried} 평균ms=${avgMs}${infraN ? ` · INFRA 제외 ${infraN}회${aborted ? '(중단됨 — 계획 8회 중 일부만 실행)' : ''}` : ''}`)
  console.log(`quiz 문항 ${quizTotal}개 중 최종 데이터의 promptKo 공백(null·빈 값) = ${koEmpty}개`)
  const blanks = ok.flatMap((r) => (r.blankQuiz ?? []).map((b) => ({ label: r.label, ...b })))
  console.log(`\n## 빈칸·밑줄형 문항 — variant=${variant} 성공 ${ok.length}회 · quiz ${quizTotal}문항 중 빈칸형 ${blanks.length}문항(promptJa 에 빈칸 표지 없음 ${blanks.filter((b) => !b.jaHasBlank).length} · 자동 suspect ${blanks.filter((b) => b.suspect).length}) — 정답 노출은 아래 표를 보고 육안 집계`)
  console.log('| run | q | promptKo | promptJa | 정답 선택지 | 표지 | suspect |')
  console.log('|---|---|---|---|---|---|---|')
  for (const b of blanks) console.log(`| ${b.label} | q${b.idx} | ${b.promptKo} | ${b.promptJa} | ${b.answerChoice} | ${b.jaHasBlank ? 'Y' : 'N'} | ${b.suspect ? 'Y' : '-'} |`)
  console.log('\n| run | 성공 | ms | attempts | promptChars | quiz(ko공백/ja null) | 1차 사유 | 최종 오류 |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    const q = r.quiz ? `${r.quiz.total}(${r.quiz.promptKoEmpty}/${r.quiz.promptJaNull})` : '-'
    console.log(`| ${r.label} | ${r.ok ? 'OK' : 'FAILED'} | ${r.ms} | ${r.attempts ?? '-'} | ${r.promptChars ?? '-'} | ${q} | ${r.firstAttemptWarn ?? '-'} | ${r.finalError ?? '-'} |`)
  }
  writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), variant, runsPaste, runsTopic, runsSource, aborted, rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
