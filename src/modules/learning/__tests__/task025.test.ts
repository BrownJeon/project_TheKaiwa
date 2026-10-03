import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { AUDIO_KINDS, audioText, readStoredContent, type StoredLessonContent } from '../lessons/content'
import { parseAudioBody } from '../lessons/validate'

const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (reason === undefined || (e.details as { reason?: string } | undefined)?.reason === reason)

/** 저장 모양(v1) 최소 본문 — 오늘의 표현 3개. */
function stored(): StoredLessonContent {
  const raw = {
    v: 1,
    title: 'カフェ',
    titleKo: '카페',
    rolesKo: { A: '점원', B: '손님' },
    dialogue: [{ speaker: 'A', ja: 'いらっしゃいませ。', reading: 'いらっしゃいませ。', ko: '어서 오세요.', segment: 1 }],
    chunks: [
      { id: 'c1', textJa: '一つ', reading: 'ひとつ', meaningKo: '하나', chunkType: 'NAME', isNew: false },
      { id: 'new-1', textJa: 'お願いします', reading: 'おねがいします', meaningKo: '부탁해요', chunkType: 'ACTION', isNew: true },
      { id: 'new-2', textJa: '大丈夫です', reading: 'だいじょうぶです', meaningKo: '괜찮아요', chunkType: 'FEELING', isNew: true },
    ],
    grammar: [],
    quiz: [],
    application: [],
    speaking: [],
    nextPreview: { titleKo: '.', teaserKo: '.' },
    segmentCount: 1,
  }
  const c = readStoredContent(raw)
  assert.ok(c)
  return c
}

test('task-025 #62c chunk: 오늘의 표현 소리는 레슨 본문의 chunks[idx].textJa 만 고른다(클라이언트 글자 없음)', () => {
  assert.ok((AUDIO_KINDS as readonly string[]).includes('chunk'))
  const c = stored()
  assert.equal(audioText(c, 'chunk', 0), '一つ')
  assert.equal(audioText(c, 'chunk', 2), '大丈夫です')
  assert.equal(audioText(c, 'chunk', 3), null, '범위 밖 → null(라우트 400 out_of_range)')
  assert.equal(audioText(c, 'chunk', -1), null)
  assert.equal(audioText(c, 'dialogue', 0), 'いらっしゃいませ。', '기존 종류는 그대로')
})

test('task-025 #62c chunk: 본문 검사 — kind chunk 허용, 글자·엔진 수치 키는 거부', () => {
  assert.deepEqual(parseAudioBody({ kind: 'chunk', idx: 1 }), { kind: 'chunk', idx: 1, pace: 'normal' })
  assert.deepEqual(parseAudioBody({ kind: 'chunk', idx: 0, pace: 'slow' }), { kind: 'chunk', idx: 0, pace: 'slow' })
  assert.throws(() => parseAudioBody({ kind: 'chunk', idx: 0, text: '任意の文' }), code('VALIDATION', 'unknown_key'))
  assert.throws(() => parseAudioBody({ kind: 'chunks', idx: 0 }), code('VALIDATION'))
  assert.throws(() => parseAudioBody({ kind: 'chunk', idx: 21 }), code('VALIDATION'))
})
