/**
 * task-079 IMP-0057 이음매(소비처 쪽) — A12 새 단어의 가타카나 표기 읽기를 히라가나 → 가타카나로 정규화해도 읽기를 쓰는 화면 쪽이 깨지지 않는다.
 * 생산 쪽(`assembleTopicWords` 가 정규화)은 `src/modules/conversation/__tests__/topicWordsQuality079.test.ts`. conversation 은 컴포넌트에서 import 할 수 없어
 * 두 시험이 **같은 기준 — 기본 사전 SEED 의 가타카나 표기 528개와 그 읽기** — 에서 만난다.
 *
 * 소비처: 한글 발음 줄 `kanaToHangul`(입력을 가타카나로 접어 처리) · 저장 읽기와 분석 읽기 대조 `readingMatches`(히라가나로 접어 비교) · 단어 루비 `alignWordRuby`(한자 없는 표기는 null).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alignWordRuby, kanaToHangul, type ReadingSegment } from '@/modules/speech/reading/client'
import { readingMatches } from '../japanese/annotations'

interface SeedWord { surface: string; reading: string }
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

function katakanaSeedWords(): SeedWord[] {
  const out: SeedWord[] = []
  for (const n of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    const f = join(process.cwd(), 'prisma/seed-data/jlpt', `${n}.json`)
    assert.ok(existsSync(f), `시드 파일이 없다: ${f}`)
    for (const s of JSON.parse(readFileSync(f, 'utf8')) as SeedWord[]) {
      if (/^[ァ-ヺー・]+$/.test(s.surface) && /[ァ-ヺ]/.test(s.surface)) out.push(s)
    }
  }
  return out
}

test('SEED 가타카나 표기 528개: 가타카나 읽기와 히라가나 읽기가 같은 한글 발음 · 저장 읽기 대조 · 루비 없음 — 정규화가 화면을 바꾸지 않는다', () => {
  const words = katakanaSeedWords()
  assert.ok(words.length >= 528, `가타카나 표기 ${words.length}개`)
  for (const s of words) {
    const hira = toHira(s.reading)
    assert.equal(kanaToHangul(s.reading), kanaToHangul(hira), `한글 발음 ${s.surface}`)
    // 분석기가 표기 그대로 읽은 조각(가타카나 표기라 루비 없음) — 저장 읽기가 어느 쪽 가나든 같은 읽기로 본다
    const seg: ReadingSegment[] = [{ surface: s.surface, ruby: null, pron: s.reading, boundary: null }]
    assert.equal(readingMatches(seg, s.reading), true, `가타카나 저장 읽기 ${s.surface}`)
    assert.equal(readingMatches(seg, hira), true, `히라가나 저장 읽기 ${s.surface}`)
    assert.equal(alignWordRuby(s.surface, s.reading), null, `한자 없는 표기는 루비 없음 ${s.surface}`)
  }
})

test('대표 사례: コーヒー — 히라가나 읽기와 가타카나 읽기가 같은 한글 줄', () => {
  assert.equal(kanaToHangul('コーヒー'), kanaToHangul('こーひー'))
  assert.equal(kanaToHangul('ピアノ'), kanaToHangul('ぴあの'))
  assert.equal(kanaToHangul('ヴァイオリン'), kanaToHangul('ゔぁいおりん'))
})
