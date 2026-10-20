/**
 * 계획표 성장 탭 문구 단일 출처(task-080, screens.md §36-5 — 승인 데모 v4 글자 그대로). 엔진·모델 이름과 JLPT 급수를 싣지 않는다.
 *
 * 승인 글과 다른 곳(Leader 결정 36-17-1 — 사용자에게 전·후 문구 공개):
 * - L3 ④ 숫자 줄에 «일부»를 더하고 «넘김»을 괄호 밖으로(`countLine`) · ⑤ 날짜 부족 한 줄(`needDays`) · ⑥ 12주에서 «기간을 늘리면…» 줄을 뺀다.
 * - L4 셈 뜻 «세요» 두 곳(`metricNote.turns`·`how[0]`)을 «계산해요»로(2026-10-07 사용자 규칙 — `challenge/__tests__/copyNoSeyo.test.ts`).
 * - L11 한쪽 증거 줄의 새 글(`axisOneSided`·`axisOneSidedSub`, 36-17-3 ① — 승인 데모에 없던 글, 사용자 전·후 공개 대상).
 *
 * 굵은 조각이 있는 문장은 문자열 HTML 이 아니라 조각 배열(`Rich`)로 돌려준다 — 화면이 `<b>` 요소로 그린다.
 */
import type { GrowthAxis } from '@/types/plan'

/** 문장 조각 — 문자열은 그대로, `{ b }` 는 굵게. */
export type Rich = readonly (string | { b: string })[]

export type MetricKey = 'days' | 'words' | 'lessons' | 'reviews' | 'turns' | 'corr'

/** 지표 칩 순서·이름·단위(데모 `METRICS` — v3 사용자 결정 «단어»·«대화»). */
export const METRICS: readonly { key: MetricKey; label: string; unit: string }[] = [
  { key: 'days', label: '공부한 날', unit: '일' },
  { key: 'words', label: '단어', unit: '세트' },
  { key: 'lessons', label: '수업', unit: '번' },
  { key: 'reviews', label: '복습', unit: '번' },
  { key: 'turns', label: '대화', unit: '번' },
  { key: 'corr', label: '교정 채택', unit: '개' },
]

/** 공부결과 축 — 이 순서로 줄을 그린다. 조사는 이름 뒤에 붙는 «이/가»(런타임 조사 함수를 쓰지 않는다). */
export const AXES: readonly { axis: GrowthAxis; name: string; desc: string; how: string; josa: string }[] = [
  { axis: 'VOCAB_RECALL', name: '어휘 회상', desc: '단어 뜻·표현을 떠올리기', how: '오늘의 단어·수업 문제를 풀면 쌓여요', josa: '이' },
  { axis: 'GRAMMAR_PARTICLE', name: '문형·조사', desc: '조사·활용·문형을 맞게 쓰기', how: '수업 문제와 대화 교정에서 쌓여요', josa: '가' },
  { axis: 'LISTEN_RESPOND', name: '듣고 응답', desc: '들은 말에 알맞게 답하기', how: '', josa: '이' },
  { axis: 'SENTENCE_PRODUCTION', name: '문장 산출', desc: '조각을 이어 문장 만들기', how: '수업 «말하기» 과제를 하면 쌓여요', josa: '이' },
  { axis: 'CONVERSATION_MAINTAIN', name: '대화 유지', desc: '대화를 끝까지 이어 가기', how: '역할극을 끝까지 마치면 1번씩 쌓여요', josa: '가' },
]

export const STAGES = ['시작 단계', '익히는 중', '자리 잡는 중', '안정적'] as const

export const GROWTH = {
  switchNav: '계획표 보기',
  switchCalendar: '달력',
  switchGrowth: '성장',
  docTitle: '성장 · 계획표',

  periodAria: '볼 기간',
  period: (w: number) => `최근 ${w}주`,
  rangeLine: (fromMd: string) => `${fromMd}(일)~오늘 · 주는 일요일에 시작해요`,
  rangeLate: (sinceMd: string) => ` · 기록은 ${sinceMd}부터라 그 전 칸은 비어 보여요`,

  tilesHeading: '한눈에',
  tileUnit: '일',
  tileStreak: '연속 출석',
  tileStreakSub: (n: number) => `가장 길게 ${n}일`,
  tileStudy: '공부한 날',
  tileStudySubLate: (n: number) => `시작한 지 ${n}일 중`,
  tileStudySub: (fromMd: string) => `${fromMd}(일)부터`,
  tileWeek: '이번 주',
  tileWeekSubSun: '오늘(일요일)부터',
  tileWeekSub: (wd: string) => `일요일~${wd}요일`,

  fewNote: (n: number) => `기록 ${n}일째예요. 능력 단계는 기록이 모이는 대로 하나씩 보여요`,
  fewNoteAxis: (name: string, josa: string): Rich => [' — 지금은 ', { b: name }, `${josa} 먼저 보이기 시작했어요.`],
  fewNoteEnd: '.',

  stripTitle: '체크내역',
  stripSide: '공부한 종류 수',
  stripLegend: ['1가지', '2가지', '3가지 이상', '출석만', '안 함'] as const,
  stripSr: (w: number, s: number, a: number) => `최근 ${w}주 동안 공부한 날 ${s}일, 출석만 한 날 ${a}일. 주별 자세한 내용은 아래 표에 있어요.`,
  stripTable: '주별로 보기',
  stripCaption: '주별 공부한 요일',
  stripCols: ['주', '공부한 요일', '출석만'] as const,
  weekCell: (sl: string, thisWeek: boolean) => `${sl} 주${thisWeek ? ' · 이번 주' : ''}`,
  stripNone: '없음',
  stripBefore: '기록 전',
  stripNoAttend: '–',
  stripFoot: '주는 일요일~토요일이에요. 괄호 숫자 = 그날 한 공부 종류 수(단어·수업·복습·대화·평가·교정 채택)',
  monthLabel: (m: number) => `${m}월`,

  barsTitle: '주마다 공부량',
  metricAria: '볼 공부량',
  metricNote: { turns: '대화에서 오간 말의 수예요. 대화를 마치고 «기록 남기기»를 고른 대화와 끝낸 역할극만 계산해요.' } as Partial<Record<MetricKey, string>>,
  readThisWeek: (md: string, wd: string) => `이번 주 ${md}(일)~오늘(${wd})`,
  readPastWeek: (md: string, endLabel: string) => `${md}(일)~${endLabel}(토)`,
  readValue: (label: string, v: number, unit: string) => `${label} ${v}${unit}`,
  readBefore: '기록을 시작하기 전이에요',
  readThisWeekSr: (md: string, wd: string) => `이번 주, ${md} 일요일부터 오늘 ${wd}요일까지`,
  readPastWeekSr: (md: string, endLabel: string) => `${md} 일요일부터 ${endLabel} 토요일까지`,
  prevWeek: '이전 주',
  nextWeek: '다음 주',
  barThisWeek: '이번 주',
  barBefore: '기록 전',
  barsTable: '표로 보기',
  barsCaption: (label: string) => `주별 ${label}`,
  barsColWeek: '주',

  skillsTitle: '공부결과',
  skillsSide: (w: number) => `최근 ${w}주`,
  skillsIntro: '공부하며 맞히고 틀린 기록으로 계산해요.',
  stageSr: (k: number) => `4단계 중 ${k}단계`,
  notRecorded: '기록 전',
  notRecordedBody: '아직 이 능력을 기록하는 공부가 없어요.',
  tooEarly: '아직 판단하기 일러요',
  axisOneSided: '교정 기록이 대부분이라 단계를 보이지 않아요.',
  /** 축마다 단계가 보이게 하는 공부 한 줄 — 듣고 응답·대화 유지는 서버가 한쪽 증거를 보낼 수 없는 축이라 빈 값(안내 줄 없음). */
  axisOneSidedSub: {
    VOCAB_RECALL: '오늘의 단어나 수업 문제도 풀면 단계가 보이기 시작해요.',
    GRAMMAR_PARTICLE: '수업 문제도 풀면 단계가 보이기 시작해요.',
    LISTEN_RESPOND: '',
    SENTENCE_PRODUCTION: '수업 «말하기» 과제도 하면 단계가 보이기 시작해요.',
    CONVERSATION_MAINTAIN: '',
  } satisfies Record<GrowthAxis, string>,
  needCount: (n: number, min: number) => `관측 ${n}건 · ${min}건이 되면 단계가 보여요`,
  needDays: (n: number, d: number, minDays: number) => `관측 ${n}건 · ${minDays}일에 걸쳐 모이면 단계가 보여요(지금 ${d}일)`,
  needSession: (n: number, min: number) => `끝낸 역할극 ${n}번 · ${min}번이 되면 단계가 보여요`,
  goRolePlay: '역할극 고르러 가기',
  countLine: (n: number, s: number, p: number, f: number, k: number) =>
    `관측 ${n}건(맞힘 ${s}${p > 0 ? ` · 일부 ${p}` : ''} · 틀림 ${f})${k > 0 ? ` · 넘김 ${k}` : ''}`,
  countLineSession: (n: number, s: number) => `끝낸 역할극 ${n}번(목표 달성 ${s})`,
  trend: {
    UP: { arrow: '↑', text: '앞 기간보다 늘었어요' },
    DOWN: { arrow: '↓', text: '앞 기간보다 줄었어요' },
    FLAT: { arrow: '→', text: '앞 기간과 비슷해요' },
  },
  trendNone: '추세는 기록이 더 모이면 보여요',
  howTitle: '단계는 이렇게 정해요',
  how: (min: number, minSession: number) =>
    [
      '오늘의 단어·수업 문제·말하기 과제·대화 교정·역할극에서 맞히고 틀린 기록(관측)으로 계산해요.',
      '교정을 받아들인 것만으로는 단계가 올라가지 않아요. 다음에 맞게 써야 올라가요.',
      '단계는 네 칸이에요: 시작 단계 → 익히는 중 → 자리 잡는 중 → 안정적.',
      `관측이 ${min}건(대화 유지는 역할극 ${minSession}번) 모이기 전에는 단계를 보여 주지 않아요.`,
      '단계는 JLPT 급수와 관계없어요. 지금 공부한 내용 안에서의 흐름이에요.',
    ] as const,

  evalTitle: 'AI 평가 점수',
  evalSide: (w: number, n: number) => `최근 ${w}주 ${n}번`,
  evalEmpty: '아직 AI 평가를 본 적이 없어요.',
  evalEmptyBody: '평가를 한 번 보면 정확성·어휘·문법·자연스러움·조각 조립 다섯 가지 점수가 여기 보여요. 10분쯤 걸려요.',
  evalGo: 'AI 평가 보러 가기',
  evalNone: '이 기간에는 본 평가가 없어요.',
  evalNoneBody: '기간을 늘리면 지난 평가가 보여요.',
  evalKindAria: '평가 종류',
  evalChip: (kindName: string, n: number) => `${kindName} ${n}`,
  evalLegendLast: (sl: string, total: number) => `${sl} ${total}점(최근)`,
  evalLegendFirst: (sl: string, total: number) => `${sl} ${total}점(이 기간 처음)`,
  evalOne: (kindName: string, level: string, total: number, grade: string): Rich => [`${kindName}(${level}) `, { b: `${total}점` }, ` · ${grade}`],
  evalOneNext: (kindName: string) => `${kindName}를 한 번 더 보면 달라진 점이 겹쳐 보여요.`,
  evalMany: (kindName: string, level: string, first: number, last: number, grade: string): Rich => [
    `${kindName}(${level}) ${first}점 → `,
    { b: `${last}점` },
    ` · ${grade}`,
  ],
  evalSrPart: (label: string, md: string, total: number, dims: string) => `${label} ${md} ${total}점: ${dims}`,
  evalSrRecent: '최근',
  evalSrFirst: '이 기간 처음',
  evalSrDim: (name: string, v: number) => `${name} ${v}점`,
  evalSrEnd: '5점 만점.',
  evalTableCaption: (kindName: string) => `${kindName} 영역별 점수(5점 만점)`,
  evalCols: ['날짜', '수준', '총점'] as const,

  soonTitle: '선생님 분석',
  soonBody: '선생님이 기록을 읽고 앞으로 2주 공부 계획을 제안해 드려요. 공부 기록이 더 쌓이면 열려요.',
  soonBadge: '곧 열려요',
  footer: '기록을 지워도 이 화면의 숫자는 바뀌지 않아요. 통계는 따로 남아요.',

  loadingSr: '성장 기록을 불러오는 중이에요',
  errTitle: '성장 기록을 불러오지 못했어요',
  errBody: '인터넷 연결을 확인하고 다시 불러와 주세요. 기록은 안전해요.',
  errRetry: '다시 불러오기',
} as const
