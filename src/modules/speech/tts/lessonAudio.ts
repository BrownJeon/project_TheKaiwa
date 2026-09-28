/**
 * 레슨 오디오(task-010 #62c, L2) — 대화 줄·문법 예문·모범 답을 **재생할 때** 기존 문장 합성 경로(#23 과 같은 파이프라인·12요소 캐시)로
 * 만든다. 한 문장이 세그먼트 상한(100자)을 넘을 수 있어(모범 답 ≤120자) 문장 단위로 나눠 조각별 서명 URL(#24)을 준다.
 *
 *  - 속도는 화면 문맥이 정한다: `slow` → LEARNING_SLOW(사용자 learningSpeed, 기본 0.8) · `normal` → LEARNING_NORMAL(1.0).
 *  - Resolver 문맥은 LESSON_READ, 발음 사전 범위는 이 레슨·주제(LESSON·COURSE 항목).
 *  - 응답에 엔진명·connection 키·캐시 키 없음. 서버 TTS 를 쓸 수 없으면 TtsUnavailableError(라우트가 422 ENGINE_UNAVAILABLE).
 */
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
}

export async function synthesizeLessonClips(input: { userId: string; text: string; pace: LessonAudioPace; lessonId: string; topicId: string | null }): Promise<{ clips: LessonAudioClip[] }> {
  const pieces = splitSentences(input.text, { maxChars: TTS_SEGMENT_MAX_CHARS }).slice(0, 4)
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
    clips: results.map((r) => ({ url: signTtsAudioToken(input.userId, r.cacheKey).url, durationMs: r.durationMs, pauseBeforeMs: r.pauseBeforeMs, cached: r.cached })),
  }
}
