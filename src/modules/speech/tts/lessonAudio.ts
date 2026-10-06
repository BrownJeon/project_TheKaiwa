/**
 * 레슨 오디오(task-010 #62c, L2) — 대화 줄·문법 예문·모범 답을 **재생할 때** 기존 문장 합성 경로(#23 과 같은 파이프라인·12요소 캐시)로
 * 만든다. 한 문장이 세그먼트 상한(100자)을 넘을 수 있어(모범 답 ≤120자) 문장 단위로 나눠 조각별 서명 URL(#24)을 준다.
 *
 *  - 속도는 화면 문맥이 정한다: `slow` → LEARNING_SLOW(사용자 learningSpeed, 기본 0.8) · `normal` → LEARNING_NORMAL(1.0).
 *  - Resolver 문맥은 LESSON_READ, 발음 사전 범위는 이 레슨·주제(LESSON·COURSE 항목).
 *  - 응답에 엔진명·connection 키·캐시 키 없음. 서버 TTS 를 쓸 수 없으면 TtsUnavailableError(라우트가 422 ENGINE_UNAVAILABLE).
 */
import { codePointLength } from '@/modules/infra'
import { signTtsAudioToken } from './audioUrl'
import { TtsRequestError } from './errors'
import { splitSentences } from './sentences'
import { synthesizeSentence, TTS_SEGMENT_MAX_CHARS } from './synthesize'

export type LessonAudioPace = 'slow' | 'normal'

export interface LessonAudioClip {
  url: string
  durationMs: number | null
  /** 이 조각 앞 재생 간격(ms) — 첫 조각 0. */
  pauseBeforeMs: number
  cached: boolean
  /**
   * 이 조각 글이 줄 글(요청 원문)에서 시작하는 **코드포인트** 위치(task-012b-4 D-T2, #62c additive) — #24 timing(조각 글 좌표)에 더하면 줄 좌표.
   * 레슨만 싣는다 — 평가 듣기(#67a)는 글을 숨기므로 문장 길이를 드러내지 않게 뺀다.
   */
  charStart?: number
}

/** 줄 글 → 합성 조각(최대 4개)과 각 조각의 줄 안 시작 코드포인트(`charStart`). */
export function lessonClipPieces(text: string): { text: string; charStart: number }[] {
  return splitSentences(text, { maxChars: TTS_SEGMENT_MAX_CHARS })
    .slice(0, 4)
    .map((p) => ({ text: p.text, charStart: codePointLength(text.slice(0, p.start)) }))
}

export async function synthesizeLessonClips(input: { userId: string; text: string; pace: LessonAudioPace; lessonId: string; topicId: string | null }): Promise<{ clips: LessonAudioClip[] }> {
  const pieces = lessonClipPieces(input.text)
  if (!pieces.length) throw new TtsRequestError('TEXT_EMPTY')
  const speechProfile = input.pace === 'slow' ? 'LEARNING_SLOW' : 'LEARNING_NORMAL'
  const results = await Promise.all(
    pieces.map((p, i) =>
      synthesizeSentence({
        userId: input.userId,
        text: p.text,
        speechProfile,
        contextMode: 'LESSON_READ',
        scope: { lessonId: input.lessonId, topicId: input.topicId },
        chunk: { index: i },
        trace: { refType: 'lessonAudio', refId: input.lessonId },
      }),
    ),
  )
  return {
    clips: results.map((r, i) => ({
      url: signTtsAudioToken(input.userId, r.cacheKey, { timing: r.timing }).url,
      durationMs: r.durationMs,
      pauseBeforeMs: r.pauseBeforeMs,
      cached: r.cached,
      charStart: pieces[i].charStart,
    })),
  }
}
