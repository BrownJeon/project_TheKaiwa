/**
 * SpeechProfile 정책표(speech-platform/16 §5). profile 은 **정책**(속도 배율·분할·간격·스타일 편향)이고 수치는
 * 여전히 User/VoiceProfile 층이 준다 — 사용자가 고른 speed 에 배율을 곱할 뿐 덮어쓰지 않는다.
 *
 * 우선순위: 요청 `speechProfile`(화면 문맥) > 사용자 설정. LLM 은 정하지 않는다.
 */
import type { SegmentStyle } from './types'

export const SPEECH_PROFILES = ['NATIVE', 'LEARNING_NORMAL', 'LEARNING_SLOW', 'PRONUNCIATION', 'SHADOWING'] as const
export type SpeechProfileName = (typeof SPEECH_PROFILES)[number]

export function isSpeechProfile(v: unknown): v is SpeechProfileName {
  return typeof v === 'string' && (SPEECH_PROFILES as readonly string[]).includes(v)
}

export interface ProfilePolicy {
  /** 사용자 speed 에 곱하는 배율. `LEARNING_SPEED` = `UserVoiceSetting.learningSpeed`(0.6·0.8·1.0). */
  speedFactor: number | 'LEARNING_SPEED'
  /** 청크 사이 재생 간격(ms). `PREVIOUS_DURATION` = 직전 청크 길이(따라 말할 시간) — 클라 큐(task-007)가 쓴다. */
  gapMs: number | 'PREVIOUS_DURATION'
  /** 、 에서도 세그먼트를 나눈다. */
  splitAtComma: boolean
  /** 세그먼트 앞 쉼(ms, 오디오에 넣지 않고 재생 간격으로 처리). */
  pauseBeforeMs: number
  /** LLM 라벨이 없을 때 쓰는 세그먼트 라벨(스타일 편향). */
  defaultLabel: SegmentStyle | null
  /** LLM `speech.style` 라벨을 따르는가. */
  honorLlmLabel: boolean
  /** 억양을 base 로 고정(라벨 배율 무시). */
  fixIntonation: boolean
}

export const PROFILE_POLICIES: Readonly<Record<SpeechProfileName, ProfilePolicy>> = {
  NATIVE: { speedFactor: 1, gapMs: 0, splitAtComma: false, pauseBeforeMs: 0, defaultLabel: null, honorLlmLabel: true, fixIntonation: false },
  LEARNING_NORMAL: { speedFactor: 1, gapMs: 200, splitAtComma: false, pauseBeforeMs: 0, defaultLabel: null, honorLlmLabel: true, fixIntonation: false },
  LEARNING_SLOW: { speedFactor: 'LEARNING_SPEED', gapMs: 300, splitAtComma: false, pauseBeforeMs: 0, defaultLabel: 'EXPLANATION', honorLlmLabel: true, fixIntonation: false },
  PRONUNCIATION: { speedFactor: 0.8, gapMs: 300, splitAtComma: true, pauseBeforeMs: 300, defaultLabel: 'EXPLANATION', honorLlmLabel: false, fixIntonation: true },
  SHADOWING: { speedFactor: 0.9, gapMs: 'PREVIOUS_DURATION', splitAtComma: false, pauseBeforeMs: 0, defaultLabel: 'CALM', honorLlmLabel: false, fixIntonation: false },
}

/**
 * 사용자 설정(#14)으로 저장·상속할 수 있는 프로필 — 설정 화면 선택지 3종. PRONUNCIATION·SHADOWING 은 **화면이 요청 단위로** 지정한다
 * (정본 speech-platform/13 §3·16 §5, domain-model UserVoiceSetting.speechProfile). Phase 1 은 3종만.
 */
export const USER_SPEECH_PROFILES = ['NATIVE', 'LEARNING_NORMAL', 'LEARNING_SLOW'] as const satisfies readonly SpeechProfileName[]

/**
 * 합성에 쓸 프로필 — 요청값(화면 문맥) > 사용자 저장값 > NATIVE. **회화(TALK) 문맥은 저장값에서 PRONUNCIATION·SHADOWING 을 물려받지
 * 않는다**(Codex C2-1): 회화방은 그 두 프로필을 지정하는 화면이 아니고, SHADOWING 의 "직전 청크 길이만큼 쉼" 은 턴 청크 동시 합성
 * (직전 길이를 모름)과 맞지 않는다. 옛 행·API 직접 호출로 저장된 값이 있어도 회화에서는 NATIVE 로 낮춘다.
 */
export function resolveSpeechProfile(i: { requested?: SpeechProfileName | null; saved?: unknown; contextMode?: string | null }): SpeechProfileName {
  if (i.requested) return i.requested
  const saved: SpeechProfileName = isSpeechProfile(i.saved) ? i.saved : 'NATIVE'
  if (i.contextMode === 'TALK' && !(USER_SPEECH_PROFILES as readonly string[]).includes(saved)) return 'NATIVE'
  return saved
}

/** LEARNING_SLOW 입력값 — 허용 프리셋만(범위 밖은 0.8). */
export function learningSpeedFactor(v: unknown): number {
  return v === 0.6 || v === 0.8 || v === 1 ? v : 0.8
}
