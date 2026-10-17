/**
 * 단어 추가 시트의 일본어 도우미 문구 단일 출처(screens §30-9, 승인 데모 `task-072-word-helper-v1` 문구 그대로). 엔진·모델 이름이 든 문구는 없다.
 * 회화방 도우미(`talk/helperCopy.ts`)와 같은 문장은 **복사하지 않고 `HELPER` 를 참조**해 두 도우미가 함께 바뀐다.
 * 꼬리표·이유는 서버가 단어 모드에서 보내지 않으므로(#181) 그 문구는 여기에 없다.
 */
import { HELPER } from '@/components/talk/helperCopy'
import { NETWORK_ERROR } from './labels'

export const WORD_HELPER = {
  button: HELPER.button,
  tip: '한국어로 물어보면 일본어 표현을 알려 줘요',
  tipClose: HELPER.tipClose,
  title: HELPER.title,
  sub: '모르는 말을 한국어로 물어보세요',
  close: HELPER.close,
  inputLabel: HELPER.inputLabel,
  ask: HELPER.ask,
  placeholder: '예: 임팩트, 어색하다',
  empty: HELPER.empty,
  count: HELPER.count,
  over: HELPER.over,
  noHangul: '한국어로 써 주세요. 일본어는 위 표현 칸에 바로 적으면 돼요.',
  examplesLead: HELPER.examplesLead,
  examples: ['임팩트', '어색하다', '귀찮다'],
  loading: HELPER.loadingSr,
  slow: HELPER.slow,
  stop: '그만두기',
  stopped: '찾기를 멈췄어요. 다시 물어볼 수 있어요.',
  found: HELPER.found,
  listAria: HELPER.listAria,
  altsAria: '다른 후보',
  more: (n: number) => `다른 후보 ${n}개 더 보기`,
  less: '다른 후보 접기',
  listen: HELPER.listen,
  stopSound: HELPER.stop,
  fill: '표현 칸에 넣기',
  filled: (ja: string) => `표현 칸에 ‘${ja}’를 넣었어요`,
  none: HELPER.none,
  noneHint: '짧은 한국어 낱말로 다시 써 보세요. 예: ‘어색하다’',
  error: HELPER.error,
  timeout: HELPER.timeout,
  retry: HELPER.retry,
  offline: NETWORK_ERROR,
  rate: HELPER.rate,
  rateDone: HELPER.rateDone,
  busy: '다른 화면에서 일본어 표현을 찾는 중이에요. 끝나면 다시 물어봐 주세요.',
} as const
