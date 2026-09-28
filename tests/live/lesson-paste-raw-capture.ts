/**
 * task-010 운영 후속(11b) 2단계 진단 — `lesson-paste-diagnose.ts` 1단계에서 5/8 실패가 전부 reading 계열 pattern
 * 위반(`LESSON_READING_PATTERN`)으로 드러났지만 ajv 오류 메시지는 "어떤 문자가 걸렸는지"를 보여주지 않는다. 이
 * 스크립트는 실패할 때까지(최대 4회 — 남은 호출 예산) sourceText 경로를 돌려 **실패한 원문(raw)** 을 파싱해서
 * reading 계열 필드마다 `LESSON_READING_PATTERN` 밖의 문자를 코드포인트로 짚어낸다. 운영 DB 를 건드리지 않는다.
 *
 * 실행: cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/lesson-paste-raw-capture.ts
 */
import { writeFileSync } from 'node:fs'
import { llm, extractJson } from '../../src/modules/engine'
import { buildLessonRequest, type LessonResponse } from '../../src/modules/conversation'
import { LESSON_READING_PATTERN } from '../../src/modules/conversation/structuredResponse/schemas'

const PASTE_TEXT =
  '昨日、友達と新しいカフェに行きました。店員さんに「ご注文はお決まりですか」と聞かれて、少し緊張しました。私はホットコーヒーを、友達は抹茶ラテを注文しました。窓の外を見ながら、週末の旅行について話しました。とても楽しい時間でした。'

const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
const RE = new RegExp(LESSON_READING_PATTERN)

function offenders(s: string): { char: string; code: string }[] {
  return [...s].filter((c) => !new RegExp(`[${LESSON_READING_PATTERN.slice(2, -3)}]`).test(c)).map((c) => ({ char: c, code: `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` }))
}

function scanReadingFields(data: LessonResponse): { path: string; value: string; offenders: { char: string; code: string }[] }[] {
  const out: { path: string; value: string; offenders: { char: string; code: string }[] }[] = []
  const push = (path: string, value: string) => {
    if (!RE.test(value)) out.push({ path, value, offenders: offenders(value) })
  }
  data.dialogue?.forEach((d, i) => push(`dialogue[${i}].reading`, d.reading))
  data.chunks?.forEach((c, i) => push(`chunks[${i}].reading`, c.reading))
  data.grammar?.forEach((g, i) => push(`grammar[${i}].exampleReading`, g.exampleReading))
  data.application?.forEach((a, i) => push(`application[${i}].modelReading`, a.modelReading))
  data.speaking?.forEach((s, i) => push(`speaking[${i}].modelReading`, s.modelReading))
  return out
}

const MAX_TRIES = 4

async function main() {
  for (let i = 1; i <= MAX_TRIES; i++) {
    const req = buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: PASTE_TEXT, acceptedCorrections: [], previousTitles: [] })
    try {
      await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
      console.log(`try#${i} OK(성공 — 이 실행은 raw 를 못 건짐, 다음 시도)`)
      continue
    } catch (e) {
      if (e instanceof llm.JsonSchemaError) {
        console.log(`try#${i} FAILED — raw 확보, ${e.raw.length}자`)
        writeFileSync(`/tmp/kaiwa-lesson-paste-raw-${i}.json`, e.raw)
        let parsed: unknown = null
        try {
          parsed = extractJson(e.raw)
        } catch {
          console.log('  extractJson 실패(파싱 불가 원문) — 파일만 남김')
          continue
        }
        const found = scanReadingFields(parsed as LessonResponse)
        console.log(`  ajv 위반: ${e.violations.join(' / ')}`)
        console.log(`  reading 필드 재스캔(pattern 재검증): ${found.length}건`)
        for (const f of found) {
          console.log(`   - ${f.path} = "${f.value}"`)
          console.log(`     offenders: ${JSON.stringify(f.offenders)}`)
        }
        writeFileSync(`/tmp/kaiwa-lesson-paste-scan-${i}.json`, JSON.stringify({ violations: e.violations, found }, null, 1))
        return // 하나만 확보하면 충분 — 호출 예산을 아낀다
      }
      console.log(`try#${i} 다른 오류: ${(e as Error).name} ${(e as Error).message.slice(0, 200)}`)
    }
  }
  console.log('실패를 재현하지 못했다(예산 내 전부 성공) — 표본 변동으로 본다.')
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
