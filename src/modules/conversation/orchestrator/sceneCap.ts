/**
 * 회화(TALK) 응답 문장 수 상한 `sceneCap` — task-024(IMP-0010). 호출 **전에** 이번 사용자 발화만 보고 코드가 정하는 순수 함수다
 * (별도 판단 LLM 호출 없음 — 5초 예산·12s fail-fast 를 늘리지 않는다). 결과는 `buildTalkRequest({ sceneCap })` 의 `[지시]` 줄과
 * 후검증 허용 문장 수(`cap + TALK_SCENE_CAP_TOLERANCE`)에만 쓰이고, persona(`--system-prompt`)·세션 캐시 키에는 섞이지 않는다.
 * cap 은 **상한**일 뿐이다 — 프롬프트가 "상한을 채우려고 늘리지 말라" 고 말하므로 모델은 그 안에서 짧게 답할 수 있다.
 *
 * 신호표(위에서부터 처음 맞는 것):
 *   1. 글자(문자·숫자)가 하나도 없음(빈 문자열·이모지·기호만)      → 2  NO_SIGNAL          (v3 와 같은 기본값)
 *   2. STT 두 번째 후보(altText)가 있음 = 인식이 불확실           → 2  ALT_CANDIDATE
 *   3. 정형 인사·맞장구(ありがとうございました·そうですか 등)      → 2  SHORT
 *   4. 물음·설명 요청                                            → 4  QUESTION           (학습자 N5·N4 는 3 — QUESTION_LOW_LEVEL)
 *   5. 짧은 평서(글자 8자 이하)                                   → 2  SHORT
 *   6. 그 밖의 평서문(교정이 붙을 수 있는 서술·되묻기 여지)         → 3  STATEMENT
 * 근거: pe-024 실측(talk@v4, 12 픽스처×3회) — cap 2 에서만 초과(3문장)가 3/9 나왔고, cap 3~4 는 범위 안 100%·평균 2.1~2.8문장이었다.
 * 그래서 짧은 발화를 확실히 cap 2 로 흡수하고(3·5), 물음은 충분히 답할 자리(4)를, 서술은 되묻기·반응 자리(6)를 준다. 교정 여부는
 * 호출 전에는 알 수 없어(교정은 응답에 들어 있다) 별도 신호가 없다 — 서술문 3 이 교정 발화의 대부분을 덮는다(교정 설명은 replyJa 에 쓰지 않는다).
 */
import { clampSceneCap, TALK_SCENE_CAP_DEFAULT } from '../prompts/talk'

export type SceneCapReason = 'NO_SIGNAL' | 'ALT_CANDIDATE' | 'SHORT' | 'QUESTION' | 'QUESTION_LOW_LEVEL' | 'STATEMENT'

export interface SceneCap {
  cap: number
  reason: SceneCapReason
}

export interface SceneCapInput {
  /** 이번 사용자 발화(저장값 그대로 — 여기서 바꾸지 않는다). */
  text: string
  /**
   * STT 두 번째 후보. 값이 있으면(공백만은 없음으로 본다) 인식이 불확실한 발화라 짧게 확인하는 쪽(2)으로 둔다.
   * 지금 턴 요청(`TurnRequest`)에는 altText 가 없어 호출부가 넘기지 않는다 — 신호 자리만 미리 열어 둔 것이다.
   */
  altText?: string | null
  /** 학습자 수준(JLPT 표기, 예 `N5`). N5·N4 는 물음에도 상한 3 — 긴 일본어 답은 듣고 따라가기 어렵다. */
  level?: string | null
}

const SHORT_MAX_CORE_CHARS = 8
/** 정형구는 짧다 — 긴 입력에는 정규식을 돌리지 않는다. */
const STOCK_MAX_CORE_CHARS = 30
const CAP_SHORT = 2
const CAP_STATEMENT = 3
const CAP_QUESTION = 4
const CAP_LOW_LEVEL_MAX = 3

/** 문자·숫자만(공백·기호·이모지 제외) — 길이 판정과 정형구 판정이 같은 잣대를 쓴다. */
function coreOf(normalized: string): string {
  return normalized.replace(/[^\p{L}\p{N}]/gu, '')
}

// 정형 인사·감사·맞장구. 물음표나 か 로 끝나도(そうですか·お元気ですか) 되묻는 게 아니라 반응이므로 물음 신호보다 먼저 거른다.
// 앞에 붙는 はい·どうも 등은 허용, 끝의 ね·よ 도 허용. 문자·숫자만 남긴 문자열 전체와 맞아야 한다(문장 속 일부는 해당 없음).
const STOCK_LEAD = '(?:はい|ええ|うん|あの|あっ|あ|えっと|えーと|どうも)*'
const STOCK_BODY = [
  'こんにちは|こんばんは|おはよう(?:ございます)?|おやすみ(?:なさい)?|はじめまして|初めまして',
  'ありがとう(?:ございます|ございました)?|すみません(?:でした)?|ごめんなさい|ごめん|失礼(?:します|しました)',
  'よろしく(?:お願い(?:します|いたします))?|お願い(?:します|いたします)|さようなら|またね|じゃあね|いってきます|ただいま|おかえり(?:なさい)?',
  'お疲れ(?:様|さま)(?:です|でした)?|いただきます|ごちそうさま(?:でした)?|お元気ですか|元気ですか',
  'そうですね|そうですか|そうなんですか|そうです|そうですよ|なるほど(?:ですね)?|わかりました|分かりました|了解(?:です|しました)?',
  'いいですね|いいですよ|いいです|大丈夫(?:です)?|本当ですか|本当に|へえ|ふうん|すごい(?:ですね)?|はい|いいえ|ええ|うん|そう',
].join('|')
const STOCK_PHRASE = new RegExp(`^${STOCK_LEAD}(?:${STOCK_BODY})(?:ね|よ)?$`, 'u')

// 물음: (a) 문장 끝 ?·？ (b) 문장 끝이 의문 종결(か·かな·…)·의문사·의 ·설명 요청 (c) 구두점 없는 STT 를 위해 정중형 + か 가 문장 중간에 있는 경우.
// STT(온디바이스)는 구두점을 붙이지 않는 일이 많아 (b)·(c)가 실질 신호다. 놓치면 cap 3 에 머물 뿐이라 비용이 작고, 지나치게 잡아도 cap 은 상한일 뿐이다.
const QUESTION_ENDING = /(?:か|かな|かしら|かね|かい|かなあ|の|何|なに|なんで|誰|だれ|どこ|いつ|どれ|どっち|どちら|いくら|いくつ|なぜ|どうして|どう)$/u
const REQUEST_ENDING = /(?:教えて|おしえて|説明して|せつめいして)(?:ください|下さい|くれ|ほしい|欲しい|もらえますか|くれませんか|ちょうだい)?$/u
const POLITE_QUESTION_ANYWHERE = /(?:です|ます|ました|でした|ません|でしょう|ましょう)か(?!ら)/u
const SEGMENT = /[^。.!?\n\r]+[。.!?]*/gu
const TRAILING_NOISE = /[\s。.!?、,…~〜ー」』）)]+$/u

function isQuestion(normalized: string): boolean {
  if (POLITE_QUESTION_ANYWHERE.test(normalized)) return true
  for (const m of normalized.matchAll(SEGMENT)) {
    const seg = m[0]
    if (seg.includes('?')) return true
    const body = seg.replace(TRAILING_NOISE, '')
    if (QUESTION_ENDING.test(body) || REQUEST_ENDING.test(body)) return true
  }
  return false
}

const LOW_LEVEL = /^N[45]$/i

export function computeSceneCap(input: SceneCapInput): SceneCap {
  // NFKC 는 판정용 사본에만 — 전각 ？·！·영숫자를 ASCII 로 접고 반각 가타카나를 합친다.
  const normalized = (typeof input.text === 'string' ? input.text : '').normalize('NFKC')
  const core = coreOf(normalized)
  if (core.length === 0) return { cap: clampSceneCap(TALK_SCENE_CAP_DEFAULT), reason: 'NO_SIGNAL' }
  if (typeof input.altText === 'string' && input.altText.trim() !== '') return { cap: CAP_SHORT, reason: 'ALT_CANDIDATE' }
  if (core.length <= STOCK_MAX_CORE_CHARS && STOCK_PHRASE.test(core)) return { cap: CAP_SHORT, reason: 'SHORT' }
  if (isQuestion(normalized)) {
    return typeof input.level === 'string' && LOW_LEVEL.test(input.level.trim())
      ? { cap: clampSceneCap(CAP_LOW_LEVEL_MAX), reason: 'QUESTION_LOW_LEVEL' }
      : { cap: clampSceneCap(CAP_QUESTION), reason: 'QUESTION' }
  }
  if ([...core].length <= SHORT_MAX_CORE_CHARS) return { cap: CAP_SHORT, reason: 'SHORT' }
  return { cap: CAP_STATEMENT, reason: 'STATEMENT' }
}
