/**
 * 평가 듣고 답하기 소리(task-011 #67a) — 들려줄 문장은 화면에 글자로 주지 않고(#66 `textHidden`) 여기서 소리로만 준다.
 * 레슨 오디오(#62c)와 같은 문장 합성 경로(#23 파이프라인·12요소 캐시)·조각별 #24 서명 URL(10분, 사용자 결속).
 *  - 속도는 LEARNING_NORMAL(1.0) 고정 — 평가는 느린 재생을 주지 않는다. Resolver 문맥 EVAL, 발음 사전 범위는 평가 주제(COURSE).
 *  - 응답에 엔진명·connection 키·캐시 키·문장 글자 없음. 서버 TTS 를 쓸 수 없으면 TtsUnavailableError(라우트가 422 ENGINE_UNAVAILABLE).
 */
import { signTtsAudioToken } from './audioUrl'
import { TtsRequestError } from './errors'
import type { LessonAudioClip } from './lessonAudio'
import { splitSentences } from './sentences'
import { synthesizeSentence, TTS_SEGMENT_MAX_CHARS } from './synthesize'

export async function synthesizeEvaluationClips(input: { userId: string; text: string; evaluationId: string; topicId: string | null }): Promise<{ clips: LessonAudioClip[] }> {
  const pieces = splitSentences(input.text, { maxChars: TTS_SEGMENT_MAX_CHARS }).slice(0, 4)
  if (!pieces.length) throw new TtsRequestError('TEXT_EMPTY')
  const results = await Promise.all(
    pieces.map((p, i) =>
      synthesizeSentence({
        userId: input.userId,
        text: p.text,
        speechProfile: 'LEARNING_NORMAL',
        contextMode: 'EVAL',
        scope: { topicId: input.topicId },
        chunk: { index: i },
        trace: { refType: 'evalAudio', refId: input.evaluationId },
      }),
    ),
  )
  return {
    clips: results.map((r) => ({ url: signTtsAudioToken(input.userId, r.cacheKey).url, durationMs: r.durationMs, pauseBeforeMs: r.pauseBeforeMs, cached: r.cached })),
  }
}
