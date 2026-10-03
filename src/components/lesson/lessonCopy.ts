/**
 * 오늘의 회화 문구(screens §12-8 — 승인 데모 v2 문구 그대로, ★ = 계약 때문에 더한 줄). 엔진·모델 이름은 어디에도 없다.
 */
import type { ChunkType } from '@/types/chat'
import type { JlptLevel } from '@/types/lesson'

export const STAGE_NAMES = ['이해', '문법', '문제', '응용', '말하기'] as const
export const CIRCLED = ['①', '②', '③', '④', '⑤'] as const
/** "③ 문제" — 단계 번호(1~5). */
export const stageLabel = (n: number) => `${CIRCLED[n - 1] ?? ''} ${STAGE_NAMES[n - 1] ?? ''}`.trim()

export const CHUNK_TYPE_ORDER: readonly ChunkType[] = ['NAME', 'ACTION', 'FEELING', 'MODIFIER']
export const CHUNK_TYPE_LABEL: Record<ChunkType, string> = { NAME: '이름 조각', ACTION: '액션 조각', FEELING: '느낌 조각', MODIFIER: '꾸밈 조각' }

export const PASTED_TOPIC = '붙여넣은 문장'

/** ⓐ 오늘 홈 카드 */
export const HOME = {
  title: '오늘의 회화',
  minutes: '약 15분',
  loading: '불러오는 중…',
  loadError: '오늘의 회화를 불러오지 못했어요.',
  startIntro: '선생님과 5단계로 수업해요. 듣기 → 문법 → 문제 → 응용 → 말하기',
  recommended: '추천 주제',
  reasonContinue: (t: string) => `지난 시간 예고 · ${t}`,
  reasonNextTopic: '같은 주제를 세 번 했어요 · 새 주제로 넘어가 봐요',
  reasonStart: '아직 해 보지 않은 주제예요',
  create: '수업 만들기',
  createAria: (t: string) => `수업 만들기, 추천 주제 ${t}`,
  pickTopic: '주제 고르기',
  creating: '만드는 중…',
  genTitle: '수업을 만들고 있어요',
  genBody: (topic: string) => `${topic} · 보통 1~2분 걸려요. 다 되면 여기서 열 수 있어요.`,
  genOpen: '보러 가기',
  progressTitle: '하던 수업이 있어요',
  readyTitle: '수업이 준비됐어요',
  progressBody: (topic: string, when: string, n: number) => `${topic} · ${when} 시작 · 5단계 중 ${n}단계 끝냄`,
  readyBody: (topic: string) => `${topic} · 5단계 · 약 15분`,
  nextStage: (label: string) => `다음은 ${label}예요. 단계마다 저장돼요.`,
  resume: '이어서 하기',
  start: '시작하기',
  stepsAria: (n: number) => `5단계 중 ${n}단계 끝냄`,
  failTitle: '수업을 만들지 못했어요',
  failBody: (topic: string) => `${topic} · 다시 만들면 대부분 잘 만들어져요.`,
  retry: '다시 만들기',
  doneTitle: '✓ 오늘 수업을 끝냈어요',
  doneBody: (topic: string, c: number, speaking: { used: number; total: number } | null) =>
    `${topic} · 문제 ${c}/5 맞힘${speaking && speaking.total > 0 ? ` · 말하기 표현 ${speaking.used}/${speaking.total}` : ''}`,
  nextTime: '다음 시간엔',
  nextLesson: '다음 수업 만들기',
  doneResult: '끝낸 수업 결과 보기',
  today: '오늘',
} as const

export const FLASH = {
  reused: '오늘 만든 수업이 있어요. 이어서 할게요.',
  generating: '만들고 있는 수업이 있어요. 끝나면 이어서 할 수 있어요.',
  rateLimited: '잠시 후 다시 눌러 주세요.',
  network: '연결하지 못했어요. 네트워크를 확인해 주세요.',
  topicMissing: '주제를 찾을 수 없어요.',
  failed: '수업을 만들지 못했어요. 잠시 후 다시 눌러 주세요.',
} as const

/** ⓑ 주제 고르기 */
export const TOPICS = {
  title: '주제 고르기',
  subtitle: '오늘의 회화',
  back: '오늘로',
  intro: (my: JlptLevel, levels: JlptLevel[]): string => {
    const order: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
    const mi = order.indexOf(my)
    const up = levels.find((l) => order.indexOf(l) > mi)
    const down = levels.find((l) => order.indexOf(l) < mi)
    if (up && down) return `어떤 이야기로 수업할까요? 내 수준(${my})과 한 단계 위·아래 주제를 보여 드려요.`
    if (up) return `어떤 이야기로 수업할까요? 내 수준(${my})과 한 단계 위(${up}) 주제를 보여 드려요.`
    if (down) return `어떤 이야기로 수업할까요? 내 수준(${my})과 한 단계 아래(${down}) 주제를 보여 드려요.`
    return `어떤 이야기로 수업할까요? 내 수준(${my}) 주제를 보여 드려요.`
  },
  lastLessons: (n: number, date: string) => `지난 수업 ${n}번 · ${date}`,
  never: '아직 수업하지 않았어요',
  loading: '주제를 불러오는 중…',
  loadError: '주제를 불러오지 못했어요.',
  empty: '보여 드릴 주제가 없어요. 문장을 붙여넣어 수업을 만들어 보세요.',
  pasteTitle: '갖고 있는 문장으로 수업 만들기',
  pasteBody: '드라마 대사나 교재 문장을 붙여넣으면 그 문장으로 수업을 만들어요.',
  pasteBtn: '문장 붙여넣기',
  sheetExpr: (n: number) => `이 주제의 표현 ${n}개`,
  continuePreview: '지난 시간 예고를 이어서 만들어요',
  sheetNote: '수업을 만드는 데 1~2분 걸려요. 만들기 시작하면 취소할 수 없어요.',
  close: '닫기',
} as const

/** ⓒ 붙여넣기 */
export const PASTE = {
  title: '문장으로 수업 만들기',
  subtitle: '오늘의 회화',
  back: '주제 고르기로',
  intro: '일본어 문장을 붙여넣으면 선생님이 그 문장으로 5단계 수업을 만들어요. 드라마 대사·노래 가사·교재 문장이 좋아요.',
  label: '붙여넣을 문장',
  placeholder: '예) 今日はいい天気ですね。\nそうですね。散歩に行きませんか。',
  hintEmpty: '50자 이상 · 3~8줄이 알맞아요',
  hintShort: (n: number) => `50자 이상 넣어 주세요 · 지금 ${n}자`,
  hintLong: '2,000자까지 넣을 수 있어요',
  hintOk: '3~8줄이 알맞아요',
  count: (n: number) => `${n.toLocaleString('ko-KR')} / 2,000자`,
  noJaTitle: '일본어 문장이 너무 적어요.',
  noJaBody: '일본어가 들어간 문장을 붙여넣어 주세요.',
  saved: '붙여넣은 문장은 이 수업과 함께 저장돼요.',
  submit: '이 문장으로 수업 만들기',
  note: '수업을 만드는 데 1~2분 걸려요. 만들기 시작하면 취소할 수 없어요.',
  blocked: '50자 이상 넣어 주세요 · 2,000자까지 넣을 수 있어요',
} as const

/** ⓓ 대기·실패 */
export const GEN = {
  title: '수업 만들기',
  hero: '선생님이 수업을 만들고 있어요',
  elapsed: (mmss: string) => `${mmss} · 보통 1~2분 걸려요`,
  offline: '연결이 끊겼어요. 다시 연결되면 이어서 확인해요. 수업은 계속 만들어지고 있어요.',
  orderTitle: '이런 순서로 공부해요',
  order: [
    ['이해', '대화를 구간별로 듣고, 들린 단어를 메모해요'],
    ['문법', '대화에 나온 문형 1~3개'],
    ['문제', '4지선다 5문제, 바로 정답 확인'],
    ['응용', '상황에 맞는 문장 3개 직접 만들기'],
    ['말하기', '목표 표현을 넣어 말하기 3개'],
  ] as const,
  leaveNote: '이 화면을 나가도 수업은 계속 만들어져요. 다 되면 오늘 탭에서 열 수 있어요. 만들기 시작한 수업은 취소할 수 없어요.',
  backToday: '오늘로 돌아가기',
  ready: '수업이 준비됐어요',
  failTitle: '수업을 만들지 못했어요',
  failBody: '선생님이 수업을 끝까지 만들지 못했어요. 다시 만들면 대부분 잘 만들어져요.',
  retry: '다시 만들기',
  otherTopic: '다른 주제 고르기',
  repaste: '문장 다시 붙여넣기',
} as const

/** ⓔ 수업 공통 */
export const LESSON = {
  srPrefix: (topic: string) => `오늘의 회화, ${topic}: `,
  back: '오늘로',
  stepsAria: (n: number) => `수업 단계, 5단계 중 ${n}단계 끝냄`,
  stepAria: (n: number, name: string, o: { done: boolean; current: boolean; locked: boolean }) =>
    `${n}단계 ${name}${o.done ? ', 끝냄' : ''}${o.current ? ', 지금 보는 단계' : ''}${o.locked ? ', 앞 단계를 마치면 열려요' : ''}`,
  locked: '앞 단계를 마치면 열려요',
  next: (n: number) => `다음 단계 · ${stageLabel(n)}`,
  toCurrent: (n: number) => `지금 단계로 · ${stageLabel(n)}`,
  reviewNote: '끝낸 단계를 다시 보는 중이에요. 저장된 답은 바뀌지 않아요.',
  saveFail: '진행 상황을 저장하지 못했어요. 다시 눌러 주세요.',
  resumeToast: (n: number) => `${stageLabel(n)}부터 이어서 해요. 앞 단계는 저장돼 있어요.`,
  notFound: '이 수업을 찾을 수 없어요.',
  notFoundBody: '주소가 잘못되었거나 삭제된 수업이에요.',
  loading: '수업을 불러오는 중…',
  loadError: '수업을 불러오지 못했어요.',
  today: '오늘로',
  alreadyDone: '이미 끝낸 수업이에요. 결과를 보여 드릴게요.',
  ttsError: '목소리를 불러오지 못했어요. 잠시 후 다시 눌러 주세요.',
  ttsRate: '잠시 후 다시 들어 주세요.',
} as const

export const U1 = {
  title: '① 이해 · 듣고 이해하기',
  desc: '구간마다 느리게 한 번, 보통 속도로 한 번 들어요. 들린 단어는 메모해 두세요.',
  descTextOnly: '지금은 선생님 목소리를 들을 수 없어요. 글자와 읽기로 대화를 따라가 보세요.',
  reading: '읽기',
  translation: '번역',
  toolsAria: '보기 설정',
  segment: (k: number) => `구간 ${k}`,
  range: (a: number, b: number) => ` · ${a}~${b}줄`,
  memoCount: (n: number) => ` · 메모 ${n}`,
  heard: '들었어요',
  read: '읽었어요',
  halfSlow: '느리게 ✓ · 보통',
  hiddenNote: '글자를 가리고 먼저 들어요.',
  showText: '글자 보기',
  hiddenSr: (role: string) => `${role}, 글자 가림`,
  ladderAria: '듣는 순서',
  ladderSlow: '① 느리게',
  ladderNormal: '② 보통 속도',
  statusFirst: '먼저 느리게 들어 봐요.',
  statusThenNormal: '이번엔 보통 속도로 들어 봐요. 글자와 함께 확인해요.',
  statusPlaying: (slow: boolean, i: number, n: number) => `${slow ? '느리게' : '보통 속도로'} 듣는 중 · ${i}/${n}줄`,
  // 줄 다시 듣기(task-025, 데모 v1 #l1-line) — 진행 기록과 무관
  lineCaption: '줄 옆 ▶ 는 그 줄만 다시 들려줘요. ‘들었어요’는 아래 구간 듣기(느리게 → 보통)로만 채워져요.',
  lineAria: (n: number, slow: boolean) => `${n}번째 줄${slow ? ' 느리게' : ''} 다시 듣기`,
  lineStopAria: (n: number) => `${n}번째 줄 멈추기`,
  lineLoading: (n: number) => `${n}번째 줄을 불러오는 중…`,
  linePlaying: (n: number, slow: boolean) => `${n}번째 줄 · ${slow ? '느리게' : '보통 속도로'} 다시 듣는 중`,
  statusDone: '이 구간을 다 들었어요. 들린 단어를 적고 다음 구간으로 가요.',
  statusAllDone: '구간을 모두 들었어요. 아래에서 들린 단어를 단어장에 넣을 수 있어요.',
  playSlow: (rate: string) => `▶ 느리게 듣기 · ${rate}배`,
  playNormal: '▶ 보통 속도로',
  againSlow: '다시 느리게',
  nextSegment: '다음 구간',
  replay: '▶ 다시 듣기',
  stop: '■ 멈춤',
  unblock: '▶ 눌러서 듣기',
  textOnlyNote: '지금은 선생님 목소리를 들을 수 없어요(자막만). 목소리가 돌아오면 듣기 버튼이 다시 보여요.',
  readNext: '읽었어요 · 다음 구간',
  readLast: '읽었어요',
  memoLabel: '들린 단어 메모',
  memoHelp: '들린 단어를 일본어로 적어요. 뜻은 몰라도 괜찮아요.',
  memoPlaceholder: '예) 注文',
  memoAdd: '추가',
  memoRemove: (w: string) => `${w} 지우기`,
  memoFull: '이 구간은 5개까지 적을 수 있어요',
  memoNotJa: '일본어로 적어 주세요. 예) 注文, ちゅうもん',
  memoDup: '이미 적은 단어예요.',
  memoLessonFull: '수업 전체에서 15개까지 적을 수 있어요.',
  sumTitle: '들린 단어 메모',
  sumEmpty: '아직 적은 단어가 없어요. 구간을 들으며 들린 단어를 적으면, 단어장에 없는 단어를 골라 제안해 드려요.',
  sumCount: (n: number) => `들린 단어 ${n}개`,
  sumHelp: '단어장에 없는 단어만 골라 제안해 드려요. 추가를 눌러야 저장돼요.',
  sumAsk: '단어장에 넣을까요?',
  sumLoading: '단어를 찾아보는 중…',
  sumResult: (n: number) => `단어 제안 ${n}개 · 선생님 제안이에요. 추가를 눌러야 단어장에 저장돼요.`,
  sumMore: (k: number) => `새로 적은 단어 ${k}개도 제안받기`,
  captionChunk: (line: number) => `단어 제안 · 대화 ${line}번째 줄`,
  captionEnrich: '단어 제안 · 선생님이 찾아본 뜻',
  memoChanged: '→ 사전에 싣는 모양으로 바꿨어요',
  memoError: '단어를 찾지 못했어요. 잠시 후 다시 눌러 주세요.',
} as const

export const SKIP_REASON: Record<string, string> = {
  IN_WORDBOOK: '이미 단어장에 있어요',
  DUPLICATE: '같은 단어를 두 번 적었어요',
  LIMIT: '메모 한도를 넘어 제안하지 않았어요',
  NOT_JAPANESE: '일본어 단어가 아니라 제안하지 않았어요',
  ENRICH_FAILED: '뜻을 찾지 못했어요. 잠시 후 다시 눌러 주세요.',
}

export const U2 = {
  title: '② 문법 · 표현과 문형',
  desc: (g: number) => `오늘 대화의 표현 조각과 문형 ${g}개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요.`,
  textOnly: '지금은 선생님 목소리를 들을 수 없어 표현·예문 듣기를 숨겼어요(자막만).',
  exprTitle: (n: number) => `오늘의 표현 ${n}개`,
  exprDesc: '대화에 나온 표현 조각이에요. 문제·응용·말하기에서 다시 써요.',
  exprDescPlay: '대화에 나온 표현 조각이에요. 누르면 소리를 들을 수 있어요. 문제·응용·말하기에서 다시 써요.',
  exprListenSr: ', 듣기',
  exprStopSr: ', 멈추기',
  newExpr: '새 표현',
  pattern: (i: number) => `문형 ${i}`,
  example: '예문',
  play: '예문 듣기',
  stopAria: '멈추기',
} as const

export const U3 = {
  title: (n: number) => `③ 문제 · ${n}문제`,
  desc: '답을 고르면 바로 정답과 설명이 나와요. 한 번만 고를 수 있어요.',
  counter: (i: number, n: number) => `문제 ${i} / ${n}`,
  correctTag: '✓ 정답',
  mineTag: '✗ 내 답',
  right: '✓ 맞았어요',
  wrong: (k: number) => `✗ 틀렸어요 · 정답은 ${k}번`,
  next: '다음 문제',
  result: '결과 보기',
  sumTitle: '③ 문제 · 결과',
  sumHead: (n: number, c: number) => `${n}문제 중 ${c}문제 맞혔어요`,
  sumLine: (mine: string | null, answer: string, correct: boolean) => (correct || mine === null ? `정답 ${answer}` : `내 답 ${mine} · 정답 ${answer}`),
  sumNote: '틀린 문제의 표현은 수업을 마치면 복습할 항목으로 기록돼요.',
  // 옛 레슨(lesson@v7 이하)에서 한국어 문제 설명이 비었을 때(task-025 결정 c=A)
  legacyPrompt: '일본어 문장을 읽고 알맞은 답을 고르세요.',
  legacyNote: '예전에 만든 수업이라 한국어 문제 설명이 없어요.',
  choicesAria: '보기',
  choiceAria: (k: number, text: string, o: { correct: boolean; mine: boolean }) => `${k}번, ${text}${o.correct ? ', 정답' : ''}${o.mine && !o.correct ? ', 내 답, 틀림' : ''}`,
} as const

export const U4 = {
  title: (n: number) => `④ 응용 · 문장 만들기 ${n}개`,
  desc: '상황에 맞는 문장을 직접 만들어요. 채점하지 않고, 모범 답안과 비교해 스스로 확인해요.',
  counter: (i: number, n: number) => `상황 ${i} / ${n}`,
  tryExpr: '써 볼 표현',
  grammarTag: '문형',
  hint: '힌트 · ',
  mine: '내 문장',
  placeholder: '일본어로 써 보세요',
  byVoice: '말로 쓰기',
  byText: '글자로 쓰기',
  count: (n: number) => `${n} / 200자`,
  voiceBox: '여기에 알아들은 말이 나와요',
  compare: '모범 답안과 비교하기',
  emptyToast: '먼저 문장을 써 보세요',
  dontKnow: '모르겠어요 · 모범 답안 보기',
  skipped: '(쓰지 않고 봤어요)',
  model: '모범 답안',
  playModel: '▶ 모범 답안 듣기',
  stop: '■ 멈춤',
  note: '채점하지 않아요. 뜻이 통하면 다르게 써도 괜찮아요. 모범 답안을 소리 내어 따라 읽어 보세요.',
  // 글자 비교(task-025, IMP-0016) — 채점이 아니라 비교 표시
  cmpDiff: '글자가 다른 곳에 밑줄을 쳤어요 · 채점이 아니에요',
  cmpSame: '＝ 모범 답안과 글자가 같아요.',
  cmpLegendMine: '점선',
  cmpLegendMineText: ' 모범 답안에 없는 글자',
  cmpLegendModel: '실선',
  cmpLegendModelText: ' 내 문장에 없는 글자',
  cmpSrModel: '모범 답안에만 있는 글자: ',
  cmpSrMine: '내 문장에만 있는 글자: ',
  cmpSrNone: '없음',
  noteCompare: '채점하지 않아요. 밑줄은 글자가 다른 곳일 뿐, 뜻이 통하면 다르게 써도 괜찮아요. 문장부호·띄어쓰기 차이는 표시하지 않아요. 모범 답안을 소리 내어 따라 읽어 보세요.',
  next: '다음 상황',
  situation: (k: number) => `상황 ${k}`,
} as const

export const U5 = {
  title: (n: number) => `⑤ 말하기 · 과제 ${n}개`,
  desc: '목표 표현을 넣어 말해 보세요. 아래 버튼을 누른 채로 말하고, 다 말하면 손을 떼요.',
  counter: (i: number, n: number) => `과제 ${i} / ${n}`,
  targets: '목표 표현',
  used: '✓ 썼어요',
  notYet: '· 아직',
  voiceBox: '버튼을 누른 채로 말하면 여기에 알아들은 말이 나와요',
  textBox: '아래 입력창에 일본어로 써서 답해요',
  skip: '이 과제 건너뛰기',
  skipped: '(건너뛰었어요)',
  said: '내가 한 말',
  wrote: '내가 쓴 답',
  myVoice: '▶ 내 목소리',
  stop: '■ 멈춤',
  allUsed: '✓ 목표 표현을 모두 썼어요',
  missed: (list: string) => `모범 답안과 비교해 보세요 · 아직 안 쓴 표현 ${list}`,
  again: '다시 하려면 아래 버튼을 또 누르고 말해요.',
  next: '다음 과제',
  finish: '수업 마치기',
  finishing: '기록하는 중…',
  finishFail: '수업 기록을 남기지 못했어요. 다시 눌러 주세요.',
  finishFail2: '여러 번 눌러도 기록은 한 번만 남아요.',
  textMode: '글자로 답하기',
  voiceMode: '말로 답하기',
  send: '확인하기',
  stopSound: '소리 멈추기',
  pttNormal: '누르고 있는 동안 말하기',
  pttBarge: '누르면 소리를 멈추고 말하기',
  inputPlaceholder: '일본어로 써서 답해 보세요',
  emptyToast: '일본어로 답을 써 주세요',
  checkFail: '확인하지 못했어요. 다시 말해 주세요.',
  noAudio: '녹음이 없어요. 내 목소리는 30일 동안만 보관해요.',
  idleAfter: '다시 하려면 또 누르고 말해요',
  checking: '확인하는 중…',
  task: (k: number) => `과제 ${k}`,
  speaking: '듣는 중 · 누르면 멈추고 말해요',
} as const

/** ⓗ 종료 카드 */
export const END = {
  title: '수업을 마쳤어요',
  subtitle: (topic: string, date: string) => `${topic} · ${date}`,
  statQuiz: '문제 정답',
  statApply: '만든 문장',
  statExpr: '쓴 표현',
  usedTitle: '말하기에서 쓴 표현',
  missedTitle: '다음엔 이 표현도 써 보세요',
  recorded: '오늘 배운 표현과 문형은 복습할 항목으로 기록했어요.',
  addedWords: (k: number) => `단어장에 넣은 단어 ${k}개 · 단어장에서 보기 ›`,
  nextTime: '다음 시간엔',
  nextLesson: '다음 수업 만들기',
  talk: '이 주제로 선생님과 이어서 말하기',
  talkNote: (topic: string) => `회화 탭에서 ‘${topic}’ 이야기로 새 회화를 시작해요.`,
  today: '오늘로',
  otherText: '다른 문장으로 수업 만들기',
  pickTopic: '주제 고르기',
} as const
