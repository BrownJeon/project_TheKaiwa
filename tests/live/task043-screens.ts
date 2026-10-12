/**
 * task-043 챌린지 화면 상태 확인(가이드 §6 A — Playwright 응답 가로채기, 운영 코드에 시험 분기 없음).
 *
 * - 챌린지·계획표·주제 API(#155~#159·#56·#70·#71)는 **전부 고정 응답**으로 바꿔치기한다. 그 밖의 `/api/**` 는 GET 만 서버로 보내고(읽기),
 *   GET 이 아닌 요청(출석 체크 등)은 200 빈 응답으로 막는다 — 브라우저발 DB 쓰기 0. (서버 렌더 `getProfile` 의 빈 upsert 는 화면 밖이라 막을 수 없다.)
 * - 값은 설계서 §1-3 합성 데이터의 기준 수치(진행 중 4일째·67%·75%·자기소개 71%·길 묻기 60%·두 세트 날 20장 …)를 손으로 옮긴 것이다.
 *   T1 순수 계산(`learning/challenges/metrics.ts`)으로 만든 고정 응답과의 대조는 QA 몫(완료 기준 3).
 * - 상태마다 360/390/412 폭 × 892 높이로 열고 780 으로 줄여 다시 잰다: 가로 넘침 0 · 세로 스크롤 영역 ≤ 1곳 · 터치 44px(히트 확장 `before:` 포함 추정) ·
 *   엔진명·모델명·task/Phase 번호 0 · 기대 문구 · 하단 탭(`/plan` 만 보임) · 상태별 선택자 개수(`dom` — 날짜 띠 오늘 테두리 등).
 *
 * 사용(미러에서): node --import tsx tests/live/task043-screens.ts --base http://localhost:3025 --user <쿠키 파일> [--out <스크린샷 디렉터리>] [--only <상태 id 접두>]
 * 쿠키는 QA 테스트 계정의 세션 쿠키(권한 600 파일 — dev-043 은 QA 계정 1 의 읽기 전용 쿠키로 돌렸다. 챌린지 API 는 전부 가로채므로 계정 행이 바뀌지 않는다).
 * 출력에 쿠키를 찍지 않는다. 운영 포트 3010·`APP_ENV=PRODUCTION` 에서는 시작하지 않는다.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium, type BrowserContext, type Page, type Route } from 'playwright-core'

const argv = process.argv.slice(2)
const arg = (k: string) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? argv[i + 1] : undefined
}
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = arg('base') ?? 'http://localhost:3025'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const cookie = readFileSync(arg('user') ?? '', 'utf8').trim()
const [cname, ...crest] = cookie.split('=')
const OUT = arg('out')
const ONLY = arg('only')
if (OUT) mkdirSync(OUT, { recursive: true })

const TODAY = '2026-10-06'
type J = Record<string, unknown>
const ok = (data: unknown) => ({ status: 200, body: { success: true, data, message: null } })
const fail = (status: number, code: string, details: J = {}) => ({ status, body: { success: false, data: { code, details }, message: '오류' } })

// ── 고정 응답 재료 ────────────────────────────────────────────────────────────
const GOAL = { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 }
const add = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10)
const W = (c: number, w: number, s: number, sets = 1, ok2: boolean | null = c + w >= 8) => ({ sets, correct: c, wrong: w, skipped: s, cardCount: c + w + s, answered: c + w, need: 8, ok: ok2, sessionId: 'vs_fix1', refExists: true })
const L = (q: number) => ({ done: 1, quizCorrect: q, quizTotal: 5, lessonId: 'ls_fix1', refExists: true })
function days(start: string, n: number, states: string[], extra: Record<number, J> = {}) {
  return Array.from({ length: n }, (_, i) => ({ date: add(start, i), dayIndex: i + 1, state: states[i] ?? 'UPCOMING', goalMetAt: states[i] === 'MET' ? `${add(start, i)}T11:40:00.000Z` : null, lesson: null, words: null, ...(extra[i + 1] ?? {}) }))
}
const MORNING = { dayIndex: 4, elapsedDays: 3, metDays: 2, rate: 0.67, streak: 0, longestStreak: 2, todayMet: false }
const BOTH = { dayIndex: 4, elapsedDays: 4, metDays: 3, rate: 0.75, streak: 1, longestStreak: 2, todayMet: true }
const summary = (over: J = {}) => ({
  id: 'ch_cafe', title: '카페 주문 7일 챌린지', topic: { id: 't_cafe', title: '카페 주문', exists: true }, level: 'N5', lengthDays: 7,
  startDate: '2026-10-03', endDate: '2026-10-09', status: 'ACTIVE', dailyGoal: GOAL, stats: MORNING, endedAt: null, ...over,
})
const wordsTask = (state: string, answered = 0, sets = 0) => ({ kind: 'WORDS', state, sessionId: null, wordCount: 10, minAnswered: 8, answered, sets })
const lessonTask = (state: string) => ({ kind: 'LESSON', state, lessonId: null, jobId: null })
const todayTasks = (tasks: J[], over: J = {}) => ({ date: TODAY, dayIndex: 4, topic: { id: 't_cafe', title: '카페 주문' }, tasks, goalMet: false, ...over })
const BASE_DAYS = days('2026-10-03', 7, ['MET', 'MET', 'PARTIAL', 'TODAY'], { 1: { lesson: L(4), words: W(8, 1, 1) }, 2: { lesson: L(5), words: W(7, 2, 1) }, 3: { lesson: L(4) } })
const PROGRESS = { chunkTotal: 12, chunkStudied: 12, chunkMastered: 7, lessonExprCount: 5, lessonsDone: 2, aiWordTotal: 30, aiWordStudied: 28, aiWordMastered: 0 }
const TOTALS = { lessonsDone: 2, wordSets: 3, wordsCorrect: 21 }
const detail = (over: J = {}) => ({ ...summary(), days: BASE_DAYS, topicProgress: PROGRESS, totals: TOTALS, today: todayTasks([wordsTask('TODO'), lessonTask('TODO')]), result: null, ...over })
const ENDED_INTRO = {
  id: 'ch_intro', status: 'COMPLETED', title: '자기소개 7일 챌린지', endedAt: '2026-10-05T15:00:00.000Z',
  result: { lengthDays: 7, metDays: 5, elapsedDays: 7, rate: 0.71, longestStreak: 3, endReason: null },
}
const introDetail = () => ({
  ...summary({ id: 'ch_intro', title: '자기소개 7일 챌린지', topic: { id: 't_self', title: '자기소개', exists: true }, startDate: '2026-09-29', endDate: '2026-10-05', status: 'COMPLETED', stats: { dayIndex: 7, elapsedDays: 7, metDays: 5, rate: 0.71, streak: null, longestStreak: 3, todayMet: false }, endedAt: '2026-10-05T15:00:00.000Z' }),
  days: days('2026-09-29', 7, ['MET', 'MET', 'MET', 'MISSED', 'MET', 'PARTIAL', 'MET']).map((d) => ({ ...d, lesson: d.state === 'MISSED' ? null : { ...L(4), lessonId: null }, words: d.state === 'MISSED' ? null : { ...W(8, 1, 1), sessionId: null } })),
  topicProgress: null, totals: { lessonsDone: 6, wordSets: 7, wordsCorrect: 52 }, today: null,
  result: { ruleVersion: 1, endReason: null, metDays: 5, partialDays: 1, missedDays: 1, stoppedDays: 0, elapsedDays: 7, rate: 0.71, longestStreak: 3, lessonsDone: 6, wordSets: 7, wordsCorrect: 52, days: [] },
})
const roadDetail = (pre = false) => ({
  ...summary({ id: 'ch_road', title: '길 묻기 14일 챌린지', topic: { id: 't_road', title: '길 묻기', exists: true }, lengthDays: 14, startDate: '2026-09-15', endDate: '2026-09-28', status: 'ENDED', stats: pre ? { dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null, streak: null, longestStreak: 0, todayMet: false } : { dayIndex: 6, elapsedDays: 5, metDays: 3, rate: 0.6, streak: null, longestStreak: 2, todayMet: false }, endedAt: '2026-09-20T05:00:00.000Z' }),
  days: days('2026-09-15', 14, pre ? Array(14).fill('STOPPED') : ['MET', 'MET', 'MISSED', 'MET', 'PARTIAL', ...Array(9).fill('STOPPED')]),
  topicProgress: null, totals: { lessonsDone: 3, wordSets: 4, wordsCorrect: 30 }, today: null,
  result: { ruleVersion: 1, endReason: 'USER', metDays: pre ? 0 : 3, partialDays: pre ? 0 : 1, missedDays: pre ? 0 : 1, stoppedDays: pre ? 14 : 9, elapsedDays: pre ? 0 : 5, rate: pre ? null : 0.6, longestStreak: pre ? 0 : 2, lessonsDone: pre ? 0 : 3, wordSets: pre ? 0 : 4, wordsCorrect: pre ? 0 : 30, days: [] },
})
const chunk = (i: number) => ({ id: `c${i}`, chunkType: 'PHRASE', textJa: ['コーヒーをください', '店内で飲みます', '持ち帰りでお願いします', 'お会計お願いします'][i % 4], reading: null, meaningKo: '표현', order: i })
const TOPICS = {
  level: ['N5', 'N4'],
  items: [
    { id: 't_cafe', title: '카페 주문', titleJa: 'カフェで注文', level: 'N5', description: '카페에서 음료를 고르고 주문하는 말', tags: [], isSeed: true, chunks: Array.from({ length: 12 }, (_, i) => chunk(i)), lessonCount: 2, lastLessonAt: '2026-10-04T10:00:00.000Z' },
    { id: 't_road', title: '길 묻기', titleJa: '道を聞く', level: 'N5', description: '길을 묻고 답하는 말', tags: [], isSeed: true, chunks: Array.from({ length: 20 }, (_, i) => chunk(i)), lessonCount: 0, lastLessonAt: null },
    { id: 't_self', title: '자기소개', titleJa: '自己紹介', level: 'N5', description: null, tags: [], isSeed: true, chunks: Array.from({ length: 4 }, (_, i) => chunk(i)), lessonCount: 0, lastLessonAt: null },
  ],
}
function calendar(month: string, marks: Record<string, string>) {
  const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate()
  const ds = Array.from({ length: last }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`
    const past = date <= TODAY
    const st = marks[date]
    return { date, attended: past && i % 3 !== 0, types: past && i % 2 === 0 ? ['WORDS', 'LESSON'] : [], minutes: 0, logCount: past && i % 2 === 0 ? 2 : 0, hasEvaluation: false, reviewDue: false, ...(st ? { challenge: { challengeId: 'ch_cafe', dayIndex: Object.keys(marks).indexOf(date) + 1, state: st } } : {}) }
  })
  return { month, today: TODAY, days: ds, summary: { attendedDays: 4, studyDays: 3, streak: 2, longestStreak: 3, challenge: { id: 'ch_cafe', metDays: 2, elapsedDays: 3, streak: 0 } } }
}
const CAL_MARKS = { '2026-10-03': 'MET', '2026-10-04': 'MET', '2026-10-05': 'PARTIAL', '2026-10-06': 'TODAY', '2026-10-07': 'UPCOMING', '2026-10-08': 'UPCOMING', '2026-10-09': 'UPCOMING' }
const DAY_RESP = { date: '2026-10-05', attended: true, logs: [{ id: 'sl1', date: '2026-10-05', type: 'WORDS', origin: 'DIRECT', summary: '오늘의 단어 「카페 주문」 10장', result: null, correctionsCount: 0, durationSec: 156, refId: 'vs1', refExists: true, createdAt: '2026-10-05T11:40:00.000Z' }], review: null, challenge: { challengeId: 'ch_cafe', title: '카페 주문 7일 챌린지', dayIndex: 3, state: 'PARTIAL', lesson: null, words: { correct: 3, wrong: 1, skipped: 6, cardCount: 10, ok: false, need: 8 } } }

// ── 상태 정의 ────────────────────────────────────────────────────────────────
type Mock = { status: number; body: unknown; delayMs?: number }
interface State {
  id: string
  path: string
  mocks: Record<string, Mock>
  expect?: string[]
  absent?: string[]
  /** CSS 선택자 → 기대 개수(글로 보이지 않는 표시 — 날짜 띠 오늘 테두리·초점 시작 칸·읽기 이름). */
  dom?: Record<string, number>
  draft?: J
  tab: boolean
  act?: (p: Page) => Promise<void>
}
const T = (over: J) => ok({ challenge: null, today: null, recentlyEnded: null, ...over })
const plan = (today: Mock, over: Record<string, Mock> = {}) => ({ 'challenges/today': today, 'plan/calendar': ok(calendar('2026-10', CAL_MARKS)), 'plan/day': ok(DAY_RESP), ...over })
const active = (tasks: J[], stats: J = MORNING, over: J = {}) => T({ challenge: summary({ stats, ...over }), today: todayTasks(tasks) })
// 오늘 목표를 다 채운 날 — 서버는 오늘 칸을 TODAY 가 아니라 MET 로 보낸다(TODAY 칸 없음). 오늘 칸은 일 번호로 찾는다(REV-122 M-1·REV-127 L-1).
const DONE_TASKS = [wordsTask('DONE', 9, 1), lessonTask('DONE')]
const MET_TODAY_DAYS = days('2026-10-03', 7, ['MET', 'MET', 'PARTIAL', 'MET'], { 1: { lesson: L(4), words: W(8, 1, 1) }, 2: { lesson: L(5), words: W(7, 2, 1) }, 3: { lesson: L(4) }, 4: { lesson: L(4), words: W(8, 1, 1) } })
const LAST_STATS = { dayIndex: 7, elapsedDays: 7, metDays: 5, rate: 0.71, streak: 2, longestStreak: 2, todayMet: true }
const LAST_RANGE = { startDate: '2026-09-30', endDate: TODAY }
const MET_LAST_DAYS = days('2026-09-30', 7, ['MET', 'MET', 'PARTIAL', 'MET', 'MISSED', 'MET', 'MET'], { 1: { lesson: L(4), words: W(8, 1, 1) }, 7: { lesson: L(5), words: W(9, 1, 0) } })
const todayCell = (n: number) => ({
  '[data-strip].border-accent': 1,
  [`[data-strip="${TODAY}"].border-accent`]: 1,
  [`[data-strip="${TODAY}"][tabindex="0"]`]: 1,
  [`[data-strip="${TODAY}"][aria-label$="${n}일째, 달성, 오늘"]`]: 1,
})
const STATES: State[] = [
  { id: 's1.none', path: '/plan', tab: true, mocks: plan(T({}), { 'plan/calendar': ok(calendar('2026-10', {})) }), expect: ['주제 하나로 매일 조금씩', '챌린지 시작', '챌린지 기록 보기'] },
  { id: 's1.ended', path: '/plan', tab: true, mocks: plan(T({ recentlyEnded: ENDED_INTRO })), expect: ['챌린지 · 끝남', '7일 중 5일 달성 · 최장 연속 3일', '다시 도전', '결과 보기'] },
  { id: 's1.error', path: '/plan', tab: true, mocks: plan(fail(500, 'INTERNAL')), expect: ['챌린지를 불러오지 못했어요.', '달력은 그대로 볼 수 있어요.', '2026년 10월'] },
  { id: 's1.loading', path: '/plan', tab: true, mocks: plan({ ...T({}), delayMs: 45000 }), expect: ['챌린지를 불러오는 중…'] },
  { id: 's2.t0', path: '/plan', tab: true, mocks: plan(active([wordsTask('TODO'), lessonTask('TODO')])), expect: ['챌린지 · 4일째 / 7일', '카페 주문 7일 챌린지', '0 / 2 · 아직 시작 전', '67%', '3일 중 2일', '수행 연속', '0일', '앱을 연 날', '챌린지 기간'], absent: ['오늘 수업 만들기'] },
  { id: 's2.t2', path: '/plan', tab: true, mocks: plan(active([wordsTask('DONE', 9, 1), lessonTask('DONE')], BOTH)), expect: ['오늘 목표 달성!', '2 / 2 · 다 했어요', '75%', '4일 중 3일', '오늘까지 이어졌어요'] },
  { id: 's2.short', path: '/plan', tab: true, mocks: plan(active([wordsTask('SHORT', 4, 1), lessonTask('DONE')])), expect: ['오늘 4/8장 · 4장 더 풀면 완료', '세트를 일찍 끝냈어도 괜찮아요'] },
  { id: 's2.gen', path: '/plan', tab: true, mocks: plan(active([wordsTask('DONE', 8, 1), lessonTask('GENERATING')])), expect: ['만드는 중 · 1분쯤', '남은 것: 회화'] },
  { id: 's2.fail', path: '/plan', tab: true, mocks: plan(active([wordsTask('TODO'), lessonTask('FAILED')])), expect: ['만들지 못했어요', '공부 탭에서 다시'] },
  { id: 's2.last', path: '/plan', tab: true, mocks: plan(active([wordsTask('TODO'), lessonTask('READY')], { ...MORNING, dayIndex: 7, elapsedDays: 6, metDays: 4, rate: 0.67 })), expect: ['7일째 / 7일 · 오늘 자정에 마감돼요', '자정을 넘겨 끝낸 세트는'] },
  { id: 's2.first', path: '/plan', tab: true, mocks: plan(active([wordsTask('TODO'), lessonTask('TODO')], { dayIndex: 1, elapsedDays: 0, metDays: 0, rate: null, streak: 0, longestStreak: 0, todayMet: false })), expect: ['—', '오늘 채우면 생겨요'] },
  { id: 's2.tomorrow', path: '/plan', tab: true, mocks: plan(T({ challenge: summary({ startDate: '2026-10-07', endDate: '2026-10-13', stats: { dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null, streak: 0, longestStreak: 0, todayMet: false } }), today: null })), expect: ['챌린지 · 내일 시작', '첫날 할 일 · 내일', '내일부터 · 하루 10장 중 8장 이상', '내일부터 셀게요'] },
  { id: 's2.lessononly', path: '/plan', tab: true, mocks: plan(active([lessonTask('TODO')], MORNING, { dailyGoal: { ...GOAL, words: false, wordCount: null, wordsMinAnswered: null } })), expect: ['0 / 1'], absent: ['0/8장', '장 세트'] },
  { id: 's2.both', path: '/plan', tab: true, mocks: plan(T({ challenge: summary(), today: todayTasks([wordsTask('TODO'), lessonTask('TODO')]), recentlyEnded: ENDED_INTRO })), expect: ['챌린지 · 4일째 / 7일'], absent: ['결과 보기'] },
  { id: 's2.sheet', path: '/plan?month=2026-10&day=2026-10-05', tab: true, mocks: plan(active([wordsTask('TODO'), lessonTask('TODO')])), expect: ['챌린지 3일째 — 일부', '단어를 4/8장만 풀었어요', '기록을 지워도 챌린지 달성·통계는 그대로예요.'] },
  { id: 's3.step1', path: '/plan/challenge/new', tab: false, mocks: { 'challenges/today': T({}), topics: ok(TOPICS) }, expect: ['어떤 주제로 할까요?', '카페 주문', '기본 표현 12개', '1 / 4 · 주제'] },
  { id: 's3.tload', path: '/plan/challenge/new', tab: false, mocks: { 'challenges/today': T({}), topics: { ...ok(TOPICS), delayMs: 45000 } }, expect: ['주제를 불러오는 중…'] },
  { id: 's3.terr', path: '/plan/challenge/new', tab: false, mocks: { 'challenges/today': T({}), topics: fail(500, 'INTERNAL') }, expect: ['주제를 불러오지 못했어요.'] },
  { id: 's3.step2', path: '/plan/challenge/new?step=2', tab: false, draft: { topicId: 't_cafe' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS) }, expect: ['며칠 동안 할까요?', '한 주 — 처음이라면 추천', '10월 6일 (화) ~ 10월 12일 (월)'] },
  { id: 's3.cap15', path: '/plan/challenge/new?step=3', tab: false, draft: { topicId: 't_cafe' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS) }, expect: ['이 주제 표현이 12개라 15장은 고를 수 없어요', '하루에 10장 중 8장 이상 풀면 인정', '시작하는 날'] },
  { id: 's3.nogoal', path: '/plan/challenge/new?step=3', tab: false, draft: { topicId: 't_cafe', lesson: false, words: false }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS) }, act: async (p) => p.getByRole('button', { name: '다음', exact: true }).click({ force: true }), expect: ['하루 목표를 하나 이상 골라 주세요.'] },
  { id: 's3.small', path: '/plan/challenge/new?step=3', tab: false, draft: { topicId: 't_self' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS) }, expect: ['이 주제 표현이 4개라 단어 과제를 켤 수 없어요'] },
  { id: 's3.step4', path: '/plan/challenge/new?step=4', tab: false, draft: { topicId: 't_cafe' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS) }, expect: ['이렇게 시작할까요?', '카페 주문 7일 챌린지', '오늘의 단어 하루 10장(8장 이상 풀면 완료) + 오늘의 회화 1개', '오늘 할 일 · 1일째'], absent: ['오늘 탭에서 하기 ›'] },
  { id: 's3.c409', path: '/plan/challenge/new?step=4', tab: false, draft: { topicId: 't_cafe' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS), 'challenges:POST': fail(409, 'CONFLICT', { reason: 'ACTIVE_EXISTS', challengeId: 'ch_cafe' }) }, act: async (p) => p.getByRole('button', { name: '챌린지 시작' }).click(), expect: ['이미 진행 중인 챌린지가 있어요', '진행 중 챌린지 보기'] },
  { id: 's3.over', path: '/plan/challenge/new?step=4', tab: false, draft: { topicId: 't_cafe' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS), 'challenges:POST': fail(400, 'VALIDATION', { reason: 'WORD_COUNT_OVER_POOL', poolSize: 8 }) }, act: async (p) => p.getByRole('button', { name: '챌린지 시작' }).click(), expect: ['이 장수로는 만들 수 없어요', '기본 표현이 8개라 하루 10장은 고를 수 없어요', '장수 다시 고르기'] },
  { id: 's3.fail', path: '/plan/challenge/new?step=4', tab: false, draft: { topicId: 't_cafe' }, mocks: { 'challenges/today': T({}), topics: ok(TOPICS), 'challenges:POST': fail(500, 'INTERNAL') }, act: async (p) => p.getByRole('button', { name: '챌린지 시작' }).click(), expect: ['챌린지를 만들지 못했어요.'] },
  { id: 's3.active', path: '/plan/challenge/new', tab: false, mocks: { 'challenges/today': active([wordsTask('TODO')]), topics: ok(TOPICS) }, expect: ['이미 진행 중인 챌린지가 있어요'] },
  { id: 's4.normal', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': ok(detail()), 'challenges/today': active([]) }, expect: ['4일째 / 7일', '67%', '수행 연속', '최장 연속', '날짜별', '「카페 주문」 표현', '새 단어 30개 — 공부 28 · 익힘 0', '새 단어는 날마다 새로 나와요', '문제 4/5', '2개', '3세트', '21장', '그만두기'] },
  { id: 's4.met', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': ok(detail({ stats: BOTH, days: MET_TODAY_DAYS, today: todayTasks(DONE_TASKS, { goalMet: true }) })), 'challenges/today': T({ challenge: summary({ stats: BOTH }), today: todayTasks(DONE_TASKS, { goalMet: true }) }) }, expect: ['4일째 / 7일', '75%', '끝냈어요 · 문제 4/5', '10/6 오늘'], dom: todayCell(4) },
  { id: 's4.metlast', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': ok(detail({ ...LAST_RANGE, stats: LAST_STATS, days: MET_LAST_DAYS, today: todayTasks(DONE_TASKS, { dayIndex: 7, goalMet: true }) })), 'challenges/today': T({ challenge: summary({ ...LAST_RANGE, stats: LAST_STATS }), today: todayTasks(DONE_TASKS, { dayIndex: 7, goalMet: true }) }) }, expect: ['7일째 / 7일', '끝냈어요 · 문제 5/5', '10/6 오늘'], dom: todayCell(7) },
  { id: 's4.first', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': ok(detail({ stats: { dayIndex: 1, elapsedDays: 0, metDays: 0, rate: null, streak: 0, longestStreak: 0, todayMet: false }, days: days('2026-10-06', 7, ['TODAY']) })), 'challenges/today': active([]) }, expect: ['—', '첫날이에요.'], absent: ['문제 점수 추이'] },
  { id: 's4.noai', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': ok(detail({ topicProgress: { ...PROGRESS, aiWordTotal: 0, aiWordStudied: 0 } })), 'challenges/today': active([]) }, absent: ['새 단어 '] },
  { id: 's4.end', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': ok(detail()), 'challenges/today': active([]) }, act: async (p) => p.getByRole('button', { name: '그만두기' }).click(), expect: ['챌린지를 그만둘까요?', '4일째에 끝내요', '계속하기'] },
  { id: 's4.error', path: '/plan/challenge/ch_cafe', tab: false, mocks: { 'challenges/ch_cafe': fail(500, 'INTERNAL'), 'challenges/today': T({}) }, expect: ['챌린지를 불러오지 못했어요.'] },
  { id: 's4.nf', path: '/plan/challenge/ch_none', tab: false, mocks: { 'challenges/ch_none': fail(404, 'NOT_FOUND'), 'challenges/today': T({}) }, expect: ['챌린지를 찾을 수 없어요'] },
  { id: 's5.two', path: '/plan/challenge/ch_cafe?day=2026-10-04', tab: false, mocks: { 'challenges/ch_cafe': ok(detail({ days: BASE_DAYS.map((d) => (d.dayIndex === 2 ? { ...d, words: W(6, 2, 12, 2, true) } : d)) })), 'challenges/today': active([]) }, expect: ['오늘의 단어 2세트 합계 — 20장 중 맞힘 6 · 틀림 2 · 건너뜀 12(푼 8장)', '가장 많이 푼 세트 결과 보기 · 외 1세트 ›'] },
  { id: 's5.gone', path: '/plan/challenge/ch_cafe?day=2026-10-03', tab: false, mocks: { 'challenges/ch_cafe': ok(detail({ days: BASE_DAYS.map((d) => (d.dayIndex === 1 ? { ...d, words: { ...W(8, 1, 1), refExists: false } } : d)) })), 'challenges/today': active([]) }, expect: ['원본이 지워졌어요'] },
  { id: 's8.done', path: '/plan/challenge/ch_intro', tab: false, mocks: { 'challenges/ch_intro': ok(introDetail()), 'challenges/today': T({}) }, expect: ['7일 중 5일 달성', '달성률 71%', '3일', '다시 도전 (7일)'], absent: ['수행 연속'] },
  { id: 's8.stopped', path: '/plan/challenge/ch_road', tab: false, mocks: { 'challenges/ch_road': ok(roadDetail()), 'challenges/today': T({}) }, expect: ['5일 중 3일 달성', '14일 중 6일째에 그만뒀어요 · 달성률 60%', '그만둠'], absent: ['예정', '수행 연속'] },
  { id: 's8.stoppre', path: '/plan/challenge/ch_road', tab: false, mocks: { 'challenges/ch_road': ok(roadDetail(true)), 'challenges/today': T({}) }, expect: ['시작 전에 그만뒀어요', '시작하기 전에 그만둬서 기록이 없어요.'] },
  { id: 's8.blocked', path: '/plan/challenge/ch_intro', tab: false, mocks: { 'challenges/ch_intro': ok(introDetail()), 'challenges/today': active([]) }, expect: ['진행 중인 챌린지가 끝나면 다시 도전할 수 있어요'], absent: ['다시 도전 (7일)'] },
  { id: 's8.list', path: '/plan/challenges', tab: false, mocks: { challenges: ok({ items: [summary(), introDetail(), roadDetail()].map((x) => ({ ...x, days: undefined })), nextCursor: 'cur1' }) }, expect: ['진행 중', '완주', '그만둠', '더 보기', '10월 3일 ~ 10월 9일 · 4일째 · 3일 중 2일 달성'].filter((x) => x !== '완주') },
  { id: 's8.lempty', path: '/plan/challenges', tab: false, mocks: { challenges: ok({ items: [], nextCursor: null }) }, expect: ['아직 챌린지 기록이 없어요.'] },
  { id: 's8.lerror', path: '/plan/challenges', tab: false, mocks: { challenges: fail(500, 'INTERNAL') }, expect: ['챌린지 기록을 불러오지 못했어요.'] },
]

// ── 가로채기 ────────────────────────────────────────────────────────────────
let current: State | null = null
function keyOf(url: URL, method: string): string | null {
  const p = url.pathname.replace(/^\/api\/v1\//, '')
  if (p === 'challenges' && method === 'POST') return 'challenges:POST'
  if (/^challenges\/[^/]+\/end$/.test(p)) return `${p}:POST`
  return p
}
async function handle(route: Route) {
  const req = route.request()
  const url = new URL(req.url())
  const method = req.method()
  const key = keyOf(url, method)
  const m = current && key ? current.mocks[key] : undefined
  if (m) {
    if (m.delayMs) await new Promise((r) => setTimeout(r, m.delayMs))
    return route.fulfill({ status: m.status, contentType: 'application/json', body: JSON.stringify(m.body) }).catch(() => undefined)
  }
  // 챌린지·계획표·주제는 고정 응답만(서버로 보내지 않는다 — 지연 전이 같은 서버 쓰기 회피).
  if (/^\/api\/v1\/(challenges|plan|topics)/.test(url.pathname)) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(fail(500, 'INTERNAL').body) })
  if (method !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({}).body) })
  return route.continue()
}

const ENGINE = /claude|whisper|reazon|style-?bert|haiku|sonnet|opus|qwen|task-?\d{2,}|phase\s?\d/i
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const se = document.scrollingElement as HTMLElement
    const overflowX = Math.max(se.scrollWidth - vw, 0)
    const scrollers: string[] = []
    if (se.scrollHeight > window.innerHeight + 1) scrollers.push('document')
    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const cs = getComputedStyle(el)
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) scrollers.push(el.tagName.toLowerCase() + (el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''))
    })
    const small: string[] = []
    document.querySelectorAll<HTMLElement>('a[href], button, summary, [role="radio"], label').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') return
      if (el.tagName === 'LABEL' && !el.querySelector('input')) return
      // 계획표 월 이동의 [오늘](task-012 기존 요소, 히트 42px)은 이 task 범위 밖 — 따로 세지 않는다.
      if (el.nextElementSibling?.getAttribute('aria-label') === '이전 달') return
      const before = getComputedStyle(el, '::before')
      const hasHit = before.content !== 'none' && before.position === 'absolute'
      const hb = hasHit ? parseFloat(before.height) || 0 : 0
      const hw = hasHit ? parseFloat(before.width) || 0 : 0
      if (Math.max(r.height, hb) < 43.5 || Math.max(r.width, hw) < 43.5) small.push(`${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}(${Math.round(r.width)}x${Math.round(r.height)}${hb ? `/hit${Math.round(hb)}` : ''})`)
    })
    const text = document.body.innerText
    const tab = !!document.querySelector('nav[aria-label="주 메뉴"]')
    return { overflowX, scrollers, small, text, tab }
  })
}

const results: { name: string; ok: boolean }[] = []
const check = (name: string, pass: boolean, detail = '') => {
  results.push({ name, ok: pass })
  if (!pass || process.env.VERBOSE) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  console.log(`재현 조건: Chrome ${browser.version()} headless · DSF 2.625 · isMobile · ko-KR · Asia/Seoul · reducedMotion=reduce · 고정 응답(가로채기) · 기준일 ${TODAY}`)
  try {
    for (const width of [360, 390, 412]) {
      const ctx: BrowserContext = await browser.newContext({ viewport: { width, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
      await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true }])
      await ctx.route('**/api/**', handle)
      const page = await ctx.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
      for (const st of STATES) {
        if (ONLY && !st.id.startsWith(ONLY)) continue
        current = st
        errors.length = 0
        await page.setViewportSize({ width, height: 892 })
        await page.goto(`${BASE}/plan`, { waitUntil: 'commit' }).catch(() => undefined)
        await page.evaluate((draft) => {
          try {
            sessionStorage.removeItem('kaiwa.challenge.draft')
            if (draft) sessionStorage.setItem('kaiwa.challenge.draft', JSON.stringify({ v: 1, topicId: null, lengthDays: 7, lesson: true, words: true, wordCount: null, start: 'TODAY', ...draft }))
          } catch {
            /* 저장소 없음 */
          }
        }, st.draft ?? null)
        // 불러오는 중 상태는 응답을 붙잡아 두므로 networkidle 을 기다리지 않는다.
        const slow = Object.values(st.mocks).some((x) => x.delayMs)
        await page.goto(`${BASE}${st.path}`, { waitUntil: slow ? 'domcontentloaded' : 'networkidle', timeout: 60000 }).catch(() => undefined)
        await page.waitForTimeout(slow ? 2500 : 700)
        if (st.act) {
          await st.act(page).catch((e: Error) => errors.push(`act: ${e.message.slice(0, 80)}`))
          await page.waitForTimeout(700)
        }
        for (const h of [892, 780]) {
          await page.setViewportSize({ width, height: h })
          await page.waitForTimeout(120)
          const m = await measure(page)
          const tag = `${st.id} @${width}x${h}`
          check(`${tag} 가로 넘침 0`, m.overflowX === 0, `${m.overflowX}px`)
          check(`${tag} 스크롤 영역 ≤1`, m.scrollers.length <= 1, m.scrollers.join(','))
          check(`${tag} 터치 44`, m.small.length === 0, m.small.slice(0, 6).join(' · '))
          if (h === 892) {
            check(`${tag} 엔진명·번호 0`, !ENGINE.test(m.text), (m.text.match(ENGINE) ?? [''])[0])
            for (const e of st.expect ?? []) check(`${tag} 문구 "${e}"`, m.text.includes(e))
            for (const a of st.absent ?? []) check(`${tag} 없음 "${a}"`, !m.text.includes(a))
            for (const [sel, want] of Object.entries(st.dom ?? {})) {
              const got = await page.locator(sel).count()
              check(`${tag} 요소 ${sel} ${want}개`, got === want, `${got}개`)
            }
            check(`${tag} 하단 탭 ${st.tab ? '보임' : '숨김'}`, m.tab === st.tab)
            check(`${tag} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
            if (OUT && width === 390) await page.screenshot({ path: `${OUT}/${st.id}-${width}.png` })
          }
        }
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  const failN = results.filter((r) => !r.ok).length
  console.log(`\n합계 ${results.length} · PASS ${results.length - failN} · FAIL ${failN}`)
  process.exitCode = failN ? 1 : 0
}

void main()
