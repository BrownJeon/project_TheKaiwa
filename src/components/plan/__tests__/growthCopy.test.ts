import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GROWTH_AXES } from '@/types/plan'
import { AXES, GROWTH, METRICS, STAGES } from '../growthCopy'

// task-080 성장 탭 문구 단일 출처(screens.md §36-5). 화면 부품은 이 파일의 글만 쓴다.
const ROOT = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const copySrc = strip(readFileSync(join(ROOT, 'growthCopy.ts'), 'utf8'))
const GROWTH_FILES = [
  'growthCopy.ts',
  'growthLogic.ts',
  'GrowthScreen.tsx',
  'GrowthSummaryTiles.tsx',
  'CheckHistoryStrip.tsx',
  'WeeklyBars.tsx',
  'ResultRows.tsx',
  'EvalRadarSection.tsx',
  'GrowthCharts.tsx',
  'GrowthSkeleton.tsx',
  'PlanSwitch.tsx',
  'growthLoader.ts',
  'useGrowthData.ts',
]
const ENGINE_NAMES = /claude|anthropic|haiku|sonnet|opus|whisper|reazon|sherpa|zipformer|style[-_ ]?bert|sbv2|qwen|ollama|gateway|model_id|speaker_id/i

test('승인 문구 글자 그대로 — 분절·기간·숫자 카드·띠·막대·공부결과·평가·끝 줄', () => {
  assert.deepEqual([GROWTH.switchNav, GROWTH.switchCalendar, GROWTH.switchGrowth, GROWTH.docTitle], ['계획표 보기', '달력', '성장', '성장 · 계획표'])
  assert.equal(GROWTH.period(8), '최근 8주')
  assert.equal(GROWTH.rangeLine('9월 27일'), '9월 27일(일)~오늘 · 주는 일요일에 시작해요')
  assert.equal(GROWTH.rangeLate('10월 8일'), ' · 기록은 10월 8일부터라 그 전 칸은 비어 보여요')
  assert.deepEqual([GROWTH.tileStreak, GROWTH.tileStudy, GROWTH.tileWeek], ['연속 출석', '공부한 날', '이번 주'])
  assert.equal(GROWTH.tileStreakSub(4), '가장 길게 4일')
  assert.equal(GROWTH.tileStudySubLate(13), '시작한 지 13일 중')
  assert.equal(GROWTH.tileStudySub('9월 27일'), '9월 27일(일)부터')
  assert.equal(GROWTH.tileWeekSubSun, '오늘(일요일)부터')
  assert.equal(GROWTH.tileWeekSub('화'), '일요일~화요일')
  assert.equal(GROWTH.fewNote(13), '기록 13일째예요. 능력 단계는 기록이 모이는 대로 하나씩 보여요')
  assert.deepEqual([GROWTH.stripTitle, GROWTH.stripSide], ['체크내역', '공부한 종류 수'])
  assert.deepEqual([...GROWTH.stripLegend], ['1가지', '2가지', '3가지 이상', '출석만', '안 함'])
  assert.equal(GROWTH.stripSr(4, 9, 1), '최근 4주 동안 공부한 날 9일, 출석만 한 날 1일. 주별 자세한 내용은 아래 표에 있어요.')
  assert.equal(GROWTH.stripFoot, '주는 일요일~토요일이에요. 괄호 숫자 = 그날 한 공부 종류 수(단어·수업·복습·대화·평가·교정 채택)')
  assert.deepEqual([GROWTH.barsTitle, GROWTH.metricAria, GROWTH.barsTable, GROWTH.stripTable], ['주마다 공부량', '볼 공부량', '표로 보기', '주별로 보기'])
  assert.deepEqual([GROWTH.skillsTitle, GROWTH.skillsSide(4), GROWTH.skillsIntro], ['공부결과', '최근 4주', '공부하며 맞히고 틀린 기록으로 계산해요.'])
  assert.deepEqual([...STAGES], ['시작 단계', '익히는 중', '자리 잡는 중', '안정적'])
  assert.equal(GROWTH.stageSr(3), '4단계 중 3단계')
  assert.equal(GROWTH.notRecordedBody, '아직 이 능력을 기록하는 공부가 없어요.')
  assert.equal(GROWTH.needCount(14, 20), '관측 14건 · 20건이 되면 단계가 보여요')
  assert.equal(GROWTH.needSession(1, 5), '끝낸 역할극 1번 · 5번이 되면 단계가 보여요')
  assert.equal(GROWTH.trendNone, '추세는 기록이 더 모이면 보여요')
  assert.deepEqual(
    Object.values(GROWTH.trend).map((t) => `${t.arrow} ${t.text}`),
    ['↑ 앞 기간보다 늘었어요', '↓ 앞 기간보다 줄었어요', '→ 앞 기간과 비슷해요'],
  )
  assert.equal(GROWTH.evalEmpty, '아직 AI 평가를 본 적이 없어요.')
  assert.equal(GROWTH.evalEmptyBody, '평가를 한 번 보면 정확성·어휘·문법·자연스러움·조각 조립 다섯 가지 점수가 여기 보여요. 10분쯤 걸려요.')
  assert.equal(GROWTH.evalOneNext('회화 평가'), '회화 평가를 한 번 더 보면 달라진 점이 겹쳐 보여요.')
  assert.equal(GROWTH.soonBody, '선생님이 기록을 읽고 앞으로 2주 공부 계획을 제안해 드려요. 공부 기록이 더 쌓이면 열려요.')
  assert.equal(GROWTH.footer, '기록을 지워도 이 화면의 숫자는 바뀌지 않아요. 통계는 따로 남아요.')
  assert.deepEqual([GROWTH.errTitle, GROWTH.errBody, GROWTH.errRetry], ['성장 기록을 불러오지 못했어요', '인터넷 연결을 확인하고 다시 불러와 주세요. 기록은 안전해요.', '다시 불러오기'])
  assert.equal(GROWTH.loadingSr, '성장 기록을 불러오는 중이에요')
})

test('지표 6개 순서·이름·단위(v3 «단어»·«대화»), 축 5개 순서 = 서버 GROWTH_AXES', () => {
  assert.deepEqual(
    METRICS.map((m) => `${m.label}/${m.unit}`),
    ['공부한 날/일', '단어/세트', '수업/번', '복습/번', '대화/번', '교정 채택/개'],
  )
  assert.deepEqual(
    AXES.map((a) => a.axis),
    [...GROWTH_AXES],
  )
  assert.deepEqual(
    AXES.map((a) => `${a.name}${a.josa}`),
    ['어휘 회상이', '문형·조사가', '듣고 응답이', '문장 산출이', '대화 유지가'],
  )
})

test('Leader 결정 L3 — 숫자 줄 «일부»·«넘김» 위치, 날짜 부족 한 줄', () => {
  assert.equal(GROWTH.countLine(96, 70, 4, 22, 6), '관측 96건(맞힘 70 · 일부 4 · 틀림 22) · 넘김 6')
  assert.equal(GROWTH.countLine(90, 70, 0, 20, 0), '관측 90건(맞힘 70 · 틀림 20)')
  assert.equal(GROWTH.needDays(25, 2, 3), '관측 25건 · 3일에 걸쳐 모이면 단계가 보여요(지금 2일)')
})

test('Leader 결정 L4 — 셈 뜻 «세요» 대신 «계산해요»(대화 주석·단계 규칙 첫 줄)', () => {
  assert.equal(GROWTH.metricNote.turns, '대화에서 오간 말의 수예요. 대화를 마치고 «기록 남기기»를 고른 대화와 끝낸 역할극만 계산해요.')
  assert.equal(GROWTH.how(20, 5)[0], '오늘의 단어·수업 문제·말하기 과제·대화 교정·역할극에서 맞히고 틀린 기록(관측)으로 계산해요.')
  assert.equal(GROWTH.how(20, 5)[3], '관측이 20건(대화 유지는 역할극 5번) 모이기 전에는 단계를 보여 주지 않아요.')
  // 승인 데모의 두 문장(«…끝낸 역할극만 세요.» · «…기록(관측)을 세요.»)이 되살아나지 않게 — 존댓말 «주세요»는 해당 없음.
  const COUNT_SEYO = /(만|을|를|로|으로|도|이렇게|합쳐서|함께) 세요/
  copySrc.split('\n').forEach((line, i) => assert.ok(!COUNT_SEYO.test(line), `growthCopy.ts:${i + 1} ${line.trim().slice(0, 80)}`))
})

test('옛 이름·금지 낱말 없음 — «날마다»·«능력 다섯 가지»·«단어 세트»·«대화 말 수», 엔진명, 단계·안내의 JLPT 급수', () => {
  for (const f of GROWTH_FILES) {
    const src = strip(readFileSync(join(ROOT, f), 'utf8'))
    for (const bad of ['날마다', '능력 다섯 가지', '단어 세트', '대화 말 수']) assert.ok(!src.includes(bad), `${f}: ${bad}`)
    assert.ok(!ENGINE_NAMES.test(src), `${f}: 엔진명`)
  }
  assert.ok(!/N[1-5]/.test(copySrc), '문구에 급수 없음(평가 표의 수준 칸만 데이터로 나온다)')
})

test('L11 한쪽 증거 줄 새 글 — 글자 그대로, 숫자·판정 낱말·셈 «세요»·급수·엔진명 없음, «…해요» 체, 역할극·대화 교정 안내 없음, 축 키 전부', () => {
  assert.equal(GROWTH.axisOneSided, '교정 기록이 대부분이라 단계를 보이지 않아요.')
  assert.deepEqual(GROWTH.axisOneSidedSub, {
    VOCAB_RECALL: '오늘의 단어나 수업 문제도 풀면 단계가 보이기 시작해요.',
    GRAMMAR_PARTICLE: '수업 문제도 풀면 단계가 보이기 시작해요.',
    LISTEN_RESPOND: '',
    SENTENCE_PRODUCTION: '수업 «말하기» 과제도 하면 단계가 보이기 시작해요.',
    CONVERSATION_MAINTAIN: '',
  })
  assert.deepEqual(Object.keys(GROWTH.axisOneSidedSub).sort(), AXES.map((a) => a.axis).sort())
  for (const t of [GROWTH.axisOneSided, ...Object.values(GROWTH.axisOneSidedSub).filter(Boolean)]) {
    assert.ok(!/세요|N[1-5]|관측|맞힘|틀림|\d/.test(t), t)
    assert.ok(!ENGINE_NAMES.test(t), t)
    assert.match(t, /해요\.$|않아요\.$/, t)
  }
  for (const t of Object.values(GROWTH.axisOneSidedSub)) assert.ok(!/역할극|대화 교정/.test(t), t)
})
