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

/** LEARNING_SLOW 입력값 — 허용 프리셋만(범위 밖은 0.8). */
export function learningSpeedFactor(v: unknown): number {
  return v === 0.6 || v === 0.8 || v === 1 ? v : 0.8
}
