/**
 * A4 레슨 신뢰도 보강(2026-09-28, Leader 결정 — task-010 developer 실측: 주제 경로 3회 중 1회 FAILED, `application`·
 * `speaking` 의 `targetIds` 가 **입력 `topic.chunks` 에는 있지만 이번 응답 `chunks` 에는 없는 id** 를 가리켰다.
 * prompt-engineer 가 lesson@v1 인계 때 "재발 가능한 함정"으로 이미 적어 둔 바로 그 패턴이 재발한 것이다).
 * `lesson@v2` 의 프롬프트 문구 보강(`prompts/lesson.ts`)만으로는 0% 를 보장하지 못하므로, **LLM 을 다시 부르지
 * 않는 결정적 보정**을 추가한다 — 우리가 이미 가진 DB 데이터(프롬프트에 실은 입력 조각)로 부족한 부분을 채우거나
 * (자리가 있으면) 잘못된 참조를 지운다(자리가 없으면).
 *
 * **"AI 산출을 채택 없이 저장하지 않는다"(CLAUDE.md) 원칙과 충돌하지 않는 이유**: 이 보정이 새로 만들어 내는 값은
 * 없다 — 채워 넣는 `chunks` 항목은 전부 **이미 `TopicChunk` 테이블에 있고 이번 레슨 생성 프롬프트에 실제로 실었던**
 * 조각 데이터를 그대로 옮긴 것뿐이다(`isNew:false` 로 출처를 응답에도 남긴다). AI 가 만든 내용(dialogue·grammar·
 * quiz·application·speaking 의 문장·설명·정답 등)은 한 글자도 건드리지 않는다 — 딱 두 가지만 한다: ① AI 가 "이미
 * 존재하는 조각을 자기 응답의 chunks 배열에 옮겨 담는 걸 깜빡한" 경우 그 조각을 대신 옮겨 주거나 ② 그마저 안 되면
 * (보정 전용 상한 `LESSON_REPAIR_CHUNKS_MAX` 도달) 잘못 걸린 참조를 지운다. 저장 여부·채택 여부는 이 파일이 관여하지 않는 기존 흐름 그대로다(레슨은
 * 완료 트랜잭션에서만 확정되고, 이 보정은 그보다 훨씬 앞선 LLM 응답 검증 단계에서 끝난다).
 *
 * **엔진 참조 동일성(읽기 전용으로 확인, 엔진 코드 미수정)**: `buildLessonRequest` 의 `extraCheck` 가 받는 `data`
 * 는 `engine/llm/index.ts` `completeJson` → `engine/json/schemaValidate.ts` `runJsonWithRetry`/`evaluateAttempt`
 * 를 따라가면 `extractAndValidate` 가 `extractJson`(raw 텍스트를 `JSON.parse`)으로 **한 번만** 만든 객체이고, 그
 * 뒤로 아무도 복제(clone/freeze)하지 않은 채 그대로 `RunJsonResult.data` → `LlmJsonResult.data` 로 반환된다
 * (`evaluateAttempt` 는 `extraCheck(result.data)` 를 부른 뒤 그 `result`(= 같은 `data` 참조를 담은 객체)를 그대로
 * 돌려준다). 그래서 여기서 `data` 를 in-place 로 고치면 호출자가 받는 최종 값도 고쳐진 채로 온다 — 엔진에 훅을
 * 추가할 필요가 없다. ajv 스키마 검증은 **이 보정보다 먼저**(원본 파싱 직후) 끝나 있으므로, 보정이 만들어 내는
 * 값(채워 넣는 chunk·줄어드는 targetIds)도 스키마 한도(개수·길이·가나 패턴)를 satisfy 하도록 이 파일이 직접
 * 확인한다(`toChunkOut` — 못 맞추면 채우지 않고 ②(제거) 경로로 넘어간다, 재검증은 다시 돌지 않기 때문).
 */
import { chunkAppearsIn } from './matching'
import { LESSON_READING_PATTERN, type ChunkType, type LessonChunkOut, type LessonResponse } from './schemas'

const LESSON_READING_RE = new RegExp(LESSON_READING_PATTERN)
/** 응답 스키마의 `chunks[]` 항목 한도(`LESSON_SCHEMA` 의 `lessonChunkOut`)와 정확히 같다 — 재검증 없이 채워 넣으므로 직접 맞춘다. */
const CHUNK_OUT_MAX = { textJa: 40, reading: 80, meaningKo: 80 } as const
/**
 * 2026-09-28 Leader 결정(2차) — task-010 lesson@v2 실측(9회 중 8회 성공)에서 유일한 FAILED(topic#2)의 근본 원인은
 * "응답 chunks 가 이미 `LESSON_CHUNKS_MAX`(8, LLM 이 아는 스키마 상한)라 채울 자리가 없고, targetIds 가 그 id
 * 하나뿐이라 빼면 빈 배열이 되어 보정도 못 하는" 경우였다 — 위반이 그대로 남아 재시도로 갔고, 재시도에서 모델이
 * chunks 를 8개 **넘게** 채워 ajv `maxItems` 위반으로 최종 실패했다.
 *
 * **`LESSON_CHUNKS_MAX` 와 분리한 이유**: LLM 에게 알리는 스키마·프롬프트 지시("4~8개")는 그대로 두고(모델은 여전히
 * 8개까지만 안다), **보정이 채워 넣을 때만** 10개까지 허용한다 — 채워 넣는 값은 AI 산출이 아니라 우리 DB 의 입력
 * 조각(`TopicChunk`) 데이터이므로 "AI 산출 무단 저장 금지" 원칙과 무관하다(repair.ts 상단 주석 ①·② 그대로). ajv 는
 * **원본 파싱 직후**(이 보정보다 먼저) 끝나 있어 보정이 만드는 9·10개짜리 배열은 다시 검증되지 않는다 — 그래서 8 을
 * 넘겨도 안전하다(모델이 스스로 9·10개를 만들어 보내면 그건 ajv 가 여전히 막는다 — 이 상수는 **보정 전용**이다).
 */
export const LESSON_REPAIR_CHUNKS_MAX = 10

/** 보정 재료로 쓸 수 있는 입력 조각 — `reading` 이 없으면(드묾) 애초에 이 목록에 넣지 않는다(호출자 책임, `prompts/lesson.ts`). */
export interface LessonRepairSourceChunk {
  id: string
  chunkType: ChunkType
  textJa: string
  reading: string
  meaningKo: string
}

export interface LessonRepairResult {
  /** 입력 조각 데이터로 `chunks` 에 채워 넣은(추가한) 개수. */
  filled: number
  /** 채우지 못해 `targetIds` 에서 뺀(제거한) 참조 개수(occurrence 단위 — 같은 id 가 여러 곳에서 빠지면 그만큼 센다). */
  removed: number
  /**
   * 2026-09-28 Leader 3차 결정 — application·speaking 의 `modelAnswerJa` 가 자기 목표 chunk 의 표현을 담고 있지
   * 않아 그 targetId 를 뺀 개수(`matching.ts` `chunkAppearsIn` 기준, occurrence 단위). `removed` 와 같은
   * "빈 배열이 되면 손대지 않는다" 규칙을 따르지만 원인이 다르므로(id 부재가 아니라 내용 불일치) 따로 센다.
   */
  contentMismatchRemoved: number
}

function toChunkOut(source: LessonRepairSourceChunk): LessonChunkOut | null {
  if (source.textJa.length > CHUNK_OUT_MAX.textJa) return null
  if (source.reading.length > CHUNK_OUT_MAX.reading) return null
  if (source.meaningKo.length > CHUNK_OUT_MAX.meaningKo) return null
  if (!LESSON_READING_RE.test(source.reading)) return null
  return { id: source.id, textJa: source.textJa, reading: source.reading, meaningKo: source.meaningKo, chunkType: source.chunkType, isNew: false }
}

/**
 * `data` 를 **in-place** 로 고친다(반환값은 채움/제거 건수뿐 — 로그용). 규칙(Leader 결정, 2026-09-28):
 *  1. `targetIds` 가 가리키는 id 가 `allowedChunks`(프롬프트에 실은 입력 조각) 에 있고, 이번 응답 `chunks`·
 *     `grammar` 어디에도 없으면 "보정 대상"이다. **입력에도 없는 id(환각)는 손대지 않는다** — 그런 위반은 여전히
 *     `checkLessonResponse` 가 잡아 기존처럼 1회 재시도로 간다.
 *  2. 응답 `chunks.length < LESSON_REPAIR_CHUNKS_MAX`(10 — LLM 에게 알리는 스키마 상한 8 보다 **보정 전용으로 2 더
 *     크다**, 위 상수 설명 참고) 이면 그 조각을 채워 넣는다(`isNew:false`). 캡·가나 패턴을 못 맞추면(원본이 병적으로
 *     길거나 reading 이 가나가 아니면) 채우지 않고 다음 규칙으로 넘어간다.
 *  3. 못 채웠으면(이미 10개 또는 ②의 조건 미달) 그 id 를 참조한 `targetIds` 배열에서 뺀다 — 단, 빼서 그 배열이 빈
 *     배열이 되면 그 occurrence 는 손대지 않는다(스키마 `minItems:1` 을 이 함수가 어기지 않기 위해서다 — 그 자리는
 *     기존 위반이 그대로 남아 재시도로 간다).
 *  4.(2026-09-28 Leader 3차 결정) `application`·`speaking` 의 `modelAnswerJa` 가 자기 목표 chunk(문법 id 는 대상
 *     아님 — `matching.ts` 주석)의 `textJa`·`reading` 어느 쪽도 담고 있지 않으면(`chunkAppearsIn`), 그 chunk id 를
 *     `targetIds` 에서 뺀다 — 역시 빼서 빈 배열이 되면 손대지 않는다(같은 이유). ①~③(id 존재)을 먼저 끝낸 뒤에
 *     돌아 `data.chunks` 가 최종 상태(보정으로 채운 것 포함)일 때 판정한다.
 */
export function repairLessonResponse(input: { allowedChunks: LessonRepairSourceChunk[] }, data: LessonResponse): LessonRepairResult {
  const bySource = new Map(input.allowedChunks.map((c) => [c.id, c]))
  const chunkIds = new Set(data.chunks.map((c) => c.id))
  const grammarIds = new Set(data.grammar.map((g) => g.id))
  const isKnown = (id: string) => chunkIds.has(id) || grammarIds.has(id)

  const targetArrays = [
    ...data.quiz.map((q) => q.targetIds),
    ...data.application.map((a) => a.targetIds),
    ...data.speaking.map((s) => s.targetIds),
  ]

  // ① 채울 후보 — "입력에 있고, 응답에는 없는" id 만(환각 id 는 bySource 에 없어 자동으로 제외된다).
  const candidates = new Set<string>()
  for (const ids of targetArrays) {
    for (const id of ids) {
      if (!isKnown(id) && bySource.has(id)) candidates.add(id)
    }
  }

  // ② 자리(보정 전용 상한 10개)가 있는 동안 순서대로 채운다 — LLM 에게 알리는 스키마 상한(8)과 다르다(위 상수 설명).
  let filled = 0
  for (const id of candidates) {
    if (data.chunks.length >= LESSON_REPAIR_CHUNKS_MAX) break
    const out = toChunkOut(bySource.get(id)!)
    if (!out) continue
    data.chunks.push(out)
    chunkIds.add(id)
    filled++
  }

  // ③ 못 채운 것은 targetIds 에서 뺀다(빈 배열이 되면 그 occurrence 는 두고 위반을 남긴다).
  let removed = 0
  const prune = (ids: string[]) => {
    const stale = ids.filter((id) => !isKnown(id) && bySource.has(id))
    if (stale.length === 0) return
    const next = ids.filter((id) => !stale.includes(id))
    if (next.length === 0) return // 빈 배열이 되면 보정하지 않는다
    removed += ids.length - next.length
    ids.length = 0
    ids.push(...next)
  }
  data.quiz.forEach((q) => prune(q.targetIds))
  data.application.forEach((a) => prune(a.targetIds))
  data.speaking.forEach((s) => prune(s.targetIds))

  // ④ application·speaking 모범 답이 자기 목표 chunk 표현을 실제로 담고 있는지(문법 id 는 대상 아님) — 못 담으면 뺀다.
  // ①~③ 뒤에 돌아 data.chunks 가 최종 상태(보정으로 채운 chunk 포함)일 때 판정한다.
  let contentMismatchRemoved = 0
  const chunkByIdFinal = new Map(data.chunks.map((c) => [c.id, c]))
  const pruneContentMismatch = (item: { targetIds: string[]; modelAnswerJa: string }) => {
    const mismatched = item.targetIds.filter((id) => {
      const c = chunkByIdFinal.get(id)
      if (!c) return false // grammar id(또는 그 밖의 이유로 여전히 없는 id — ③이 이미 처리했어야 한다)는 대상 아님
      return !chunkAppearsIn(item.modelAnswerJa, c)
    })
    if (mismatched.length === 0) return
    const next = item.targetIds.filter((id) => !mismatched.includes(id))
    if (next.length === 0) return // 전부 못 담으면 손대지 않는다(위반으로 남겨 재시도)
    contentMismatchRemoved += item.targetIds.length - next.length
    item.targetIds.length = 0
    item.targetIds.push(...next)
  }
  data.application.forEach(pruneContentMismatch)
  data.speaking.forEach(pruneContentMismatch)

  return { filled, removed, contentMismatchRemoved }
}
