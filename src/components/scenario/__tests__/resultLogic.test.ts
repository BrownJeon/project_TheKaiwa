import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChatDetail, RolePlayChatView, RolePlayResultView } from '@/types/chat'
import {
  jaSubjectJosa,
  lessonOverlap,
  lessonPickOf,
  nextPlan,
  normalizeJa,
  outcomeView,
  overlapTail,
  resultChips,
  resultStateOf,
  resultSteps,
  retryFailureText,
  rolePlayRowOf,
} from '../resultLogic'
import { RESULT } from '../scenarioCopyResult'

const result = (over: Partial<RolePlayResultView> = {}): RolePlayResultView => ({
  replayed: false,
  chatId: 'c1',
  scenarioId: 's1',
  studyLogId: 'l1',
  repetitionItemId: null,
  outcome: 'ACHIEVED',
  goalAchieved: true,
  tutorGoalAchieved: true,
  codeRulePassed: true,
  communicationSuccess: true,
  judged: true,
  expressions: { usedIds: ['k1', 'k2', 'k3'], missedIds: ['k4'], verifiedIds: ['k1', 'k2'], required: 2, total: 4 },
  turns: 5,
  hintsUsed: 1,
  selfCorrections: 1,
  pendingCorrections: 0,
  endedAt: '2026-10-06T03:00:00.000Z',
  ...over,
})
const view = (ended: RolePlayResultView | null): RolePlayChatView => ({
  id: 's1',
  title: '카페 주문',
  titleJa: 'カフェで注文',
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '주문해요',
  steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }],
  keyExpressions: [
    { id: 'k1', ja: 'アイスで', ko: '아이스로' },
    { id: 'k2', ja: 'Mサイズ', ko: 'M 사이즈' },
    { id: 'k3', ja: 'ください', ko: '주세요' },
    { id: 'k4', ja: 'これで', ko: '이걸로' },
  ],
  requiredExpressions: 2,
  progress: { usedIds: [], stepIndex: null },
  ended,
})
const detail = (scenario: RolePlayChatView | null | undefined, kind: 'TALK' | 'CHAT' = 'TALK'): Pick<ChatDetail, 'chat'> => ({
  chat: { id: 'c1', kind, title: 't', running: false, reviewedAt: null, messageCount: 3, ...(scenario !== undefined ? { scenario } : {}) },
})
const rowValue = (v: ReturnType<typeof outcomeView>, key: string) => v.rows.find((r) => r.key === key)?.value

test('결과 읽기 상태: 읽는 중·실패·404·역할극 아님·마치지 않음·결과', () => {
  assert.equal(resultStateOf({ status: 'loading', errStatus: null, data: null }).kind, 'loading')
  assert.equal(resultStateOf({ status: 'error', errStatus: 500, data: null }).kind, 'error')
  assert.equal(resultStateOf({ status: 'error', errStatus: 0, data: null }).kind, 'error')
  assert.equal(resultStateOf({ status: 'error', errStatus: 404, data: null }).kind, 'gone')
  assert.equal(resultStateOf({ status: 'ready', errStatus: null, data: detail(undefined) }).kind, 'gone')
  assert.equal(resultStateOf({ status: 'ready', errStatus: null, data: detail(null) }).kind, 'gone')
  assert.equal(resultStateOf({ status: 'ready', errStatus: null, data: detail(view(result()), 'CHAT') }).kind, 'gone')
  assert.equal(resultStateOf({ status: 'ready', errStatus: null, data: detail(view(null)) }).kind, 'notEnded')
  const ready = resultStateOf({ status: 'ready', errStatus: null, data: detail(view(result())) })
  assert.equal(ready.kind, 'ready')
  assert.equal(ready.kind === 'ready' && ready.view.ended.chatId, 'c1')
})

test('outcomeView: 달성 — 세 줄 모두 ✓, 기록 문구 달성, 안내 없음', () => {
  const v = outcomeView(result())
  assert.equal(v.title, '목표를 달성했어요')
  assert.equal(v.achieved, true)
  assert.equal(v.icon, '✓')
  assert.deepEqual(v.rows.map((r) => [r.key, r.value, r.ok]), [
    ['tutor', '목표를 이뤘어요 ✓', true],
    ['comm', '잘 통했어요 ✓', true],
    ['expr', '3/4 · 2개 이상 ✓', true],
  ])
  assert.equal(v.note, null)
  assert.equal(v.recordNote, RESULT.recordAchieved)
})

test('outcomeView: 거의 — 선생님 달성·표현 모자람(남은 개수 = 필요 − 쓴 수)', () => {
  const v = outcomeView(result({ outcome: 'ALMOST', goalAchieved: false, codeRulePassed: false, expressions: { usedIds: ['k1'], missedIds: ['k2', 'k3', 'k4'], verifiedIds: ['k1'], required: 3, total: 4 } }))
  assert.equal(v.title, '거의 다 왔어요')
  assert.equal(v.achieved, false)
  assert.equal(v.icon, '△')
  assert.equal(rowValue(v, 'expr'), '1/4 · 3개 이상 필요')
  assert.equal(v.note, '선생님은 목표를 이뤘다고 봤어요. 핵심 표현을 2개만 더 쓰면 달성이에요.')
  assert.equal(v.recordNote, RESULT.recordNotYet)
})

test('outcomeView: 아직 — 선생님 아직이면 안내 문장 없음, 뜻 전달 거짓', () => {
  const v = outcomeView(result({ outcome: 'NOT_YET', goalAchieved: false, tutorGoalAchieved: false, communicationSuccess: false, codeRulePassed: false, expressions: { usedIds: [], missedIds: ['k1', 'k2', 'k3', 'k4'], verifiedIds: [], required: 2, total: 4 } }))
  assert.equal(v.title, '아직 목표 전이에요')
  assert.equal(rowValue(v, 'tutor'), '아직이에요')
  assert.equal(rowValue(v, 'comm'), '조금 막혔어요')
  assert.equal(rowValue(v, 'expr'), '0/4 · 2개 이상 필요')
  assert.equal(v.note, null)
})

test('outcomeView: 판단 없음(judged:false) — "판단 전에 마쳤어요"·뜻 전달 "—"·판단 없음 안내, 표현만 채웠으면 거의', () => {
  const v = outcomeView(result({ outcome: 'ALMOST', goalAchieved: false, judged: false, tutorGoalAchieved: null, communicationSuccess: null }))
  assert.equal(v.title, '거의 다 왔어요')
  assert.equal(rowValue(v, 'tutor'), '판단 전에 마쳤어요')
  assert.equal(v.rows.find((r) => r.key === 'tutor')?.ok, false)
  assert.equal(rowValue(v, 'comm'), '—')
  assert.equal(v.note, RESULT.unjudgedNote)
  // 판정이 있어도 뜻 전달 값이 없으면 "—"
  assert.equal(rowValue(outcomeView(result({ communicationSuccess: null })), 'comm'), '—')
})

test('대화 순서 줄: 진행 값 있으면 s/S, 없으면 단계 수만, 단계 없으면 줄 없음', () => {
  assert.deepEqual(resultSteps(4, 1), { value: '2/4단계', ok: false })
  assert.deepEqual(resultSteps(4, 0), { value: '1/4단계', ok: false })
  assert.deepEqual(resultSteps(4, 3), { value: '4/4단계', ok: true })
  assert.deepEqual(resultSteps(4, 9), { value: '4/4단계', ok: true })
  assert.deepEqual(resultSteps(3, null), { value: '3단계', ok: false })
  assert.deepEqual(resultSteps(3, -1), { value: '3단계', ok: false })
  assert.equal(resultSteps(0, 2), null)
  const v = outcomeView(result(), { count: 3, stepIndex: null })
  assert.deepEqual(v.rows.map((r) => r.key), ['tutor', 'comm', 'expr', 'steps'])
  assert.equal(rowValue(v, 'steps'), '3단계')
  assert.deepEqual(outcomeView(result(), { count: 0, stepIndex: null }).rows.map((r) => r.key), ['tutor', 'comm', 'expr'])
})

test('표현 칩: id 순서·사라진 id 건너뜀·중복 한 번', () => {
  const ex = view(null).keyExpressions
  assert.deepEqual(resultChips(ex, ['k3', 'gone', 'k1', 'k3']).map((c) => c.id), ['k3', 'k1'])
  assert.deepEqual(resultChips(ex, []), [])
})

test('다음 버튼: 달성+다음 상황이면 다음이 주 버튼, 그 밖 다시 해 보기, 다음 없음', () => {
  const next = { id: 's2', title: '포장', titleJa: null, goalKo: '포장으로 바꿔요' }
  assert.deepEqual(nextPlan({ outcome: 'ACHIEVED', next }), { primary: 'next', next })
  assert.deepEqual(nextPlan({ outcome: 'ALMOST', next }), { primary: 'retry', next })
  assert.deepEqual(nextPlan({ outcome: 'ACHIEVED' }), { primary: 'retry', next: null })
  assert.deepEqual(nextPlan({ outcome: 'ACHIEVED', next: { ...next, id: '' } }), { primary: 'retry', next: null })
})

test('다시 해 보기 실패 문구', () => {
  assert.equal(retryFailureText('rate'), RESULT.retryRate)
  assert.equal(retryFailureText('archived'), RESULT.retryGone)
  assert.equal(retryFailureText('gone'), RESULT.retryGone)
  assert.equal(retryFailureText('fail'), RESULT.retryFail)
})

test('수업 카드: 겹치는 표현(구두점·〜·공백 무시, 상황 순서, 최대 2) · 조사', () => {
  const tilde = String.fromCodePoint(0x301c)
  const chunks = [{ textJa: `${tilde}をください` }, { textJa: '冷たい' }, { textJa: 'Mサイズ。' }]
  const ex = [{ ja: 'Mサイズ' }, { ja: 'をください' }, { ja: '冷たい' }, { ja: 'こんにちは' }]
  assert.deepEqual(lessonOverlap(chunks, ex), ['Mサイズ', 'をください'])
  assert.deepEqual(lessonOverlap(chunks, ex, 3), ['Mサイズ', 'をください', '冷たい'])
  assert.deepEqual(lessonOverlap([], ex), [])
  assert.deepEqual(lessonOverlap([{ textJa: 'ください' }], [{ ja: 'をください' }]), [])
  assert.equal(normalizeJa(' 冷たい、です！ '), '冷たいです')
  assert.equal(jaSubjectJosa('ください'), '가')
  assert.equal(jaSubjectJosa('ラーメン'), '이')
  assert.equal(jaSubjectJosa('ごはん'), '이')
  assert.equal(jaSubjectJosa('コーヒー'), '가')
  assert.equal(jaSubjectJosa('注文'), '이(가)')
  assert.equal(overlapTail(['冷たい', 'ください']), '가 핵심 표현에 들어 있어요.')
  assert.equal(overlapTail([]), null)
  assert.equal(lessonPickOf({ items: [{ id: 's9' }] }), 's9')
  assert.equal(lessonPickOf({ items: [] }), null)
  assert.equal(lessonPickOf(null), null)
})

test('회화 목록 뱃지: scenario 칸·scenarioId 가 있을 때만 역할극, 끝남은 참/결과 객체', () => {
  assert.equal(rolePlayRowOf({ id: 'c1' }), null)
  assert.equal(rolePlayRowOf({ scenario: null }), null)
  assert.equal(rolePlayRowOf({ scenario: { ended: true } }), null)
  assert.deepEqual(rolePlayRowOf({ scenario: { id: 's1', ended: false } }), { ended: false })
  assert.deepEqual(rolePlayRowOf({ scenario: { id: 's1', ended: true } }), { ended: true })
  assert.deepEqual(rolePlayRowOf({ scenario: { id: 's1', ended: { outcome: 'ACHIEVED' } } }), { ended: true })
  assert.deepEqual(rolePlayRowOf({ scenario: { id: 's1', ended: null } }), { ended: false })
  assert.deepEqual(rolePlayRowOf({ scenarioId: 's1' }), { ended: false })
})

test('결과 화면은 읽기만 한다(D-9) — 결과 훅·화면에 쓰기 요청·마치기 경로 없음, 다시 시작은 누를 때만', () => {
  const dir = join(process.cwd(), 'src/components/scenario')
  const hook = readFileSync(join(dir, 'useRolePlayResult.ts'), 'utf8')
  const screen = readFileSync(join(dir, 'RolePlayResultScreen.tsx'), 'utf8')
  for (const [name, src] of [['useRolePlayResult', hook], ['RolePlayResultScreen', screen]] as const) {
    assert.doesNotMatch(src, /\bapi(Post|Put|Patch|Delete|Upload|Stream)\b/, `${name}: 쓰기 요청 함수`)
    assert.doesNotMatch(src, /scenario\/finish/, `${name}: 마치기 경로`)
    assert.doesNotMatch(src, /\bfetch\(|method\s*:/, `${name}: 직접 요청`)
  }
  assert.match(hook, /useKeyedResource/)
  assert.doesNotMatch(hook, /after=/)
  // 역할극 다시 시작(#28)은 버튼 눌렀을 때만 — useEffect 안에서 부르지 않는다.
  const effects = screen.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[/g) ?? []
  for (const e of effects) assert.doesNotMatch(e, /\.start\(/, 'useEffect 안 역할극 시작')
  assert.match(screen, /onClick=\{\(\) => void retry\(\)\}/)
})
