/**
 * #57·#171 저장 본문 검사(task-045 T2) — 학습자가 고친 값을 **초안과 같은 규칙**으로 다시 본다(라우트가 L2 검사와 L3 저장을 조합하는 자리).
 *
 * - 글자 상한 = AI 초안 계약(`TOPIC_SAVE_LIMITS` = `TOPIC_DRAFT_LIMITS` 의 결과 칸 값). 제목 1~20 · 일본어 제목 ≤20(가나·한자 포함·한글 없음) · 설명 ≤120 ·
 *   표현 8~20개(표기 ≤20·읽기 ≤40·뜻 ≤30 — `checkTopicChunkFields` 가 초안과 같은 문자·읽기 대조 규칙으로 본다).
 * - 제목·일본어 제목·설명: 줄바꿈·탭은 공백 한 칸으로 접고 앞뒤 공백을 걷은 뒤 `detectUnsafeUserTopicText` — **이모지에 붙은 VS16·ZWJ 는 허용**(REV-148 L-8),
 *   꺾쇠·URL·비밀 모양·그 밖의 숨은·제어 문자는 400(보이지 않는 글자를 조용히 지우지 않는다). 엔진·모델 이름은 막지 않는다(Leader 결정 — 표현 칸만 기존 규칙).
 * - 같은 표기·같은 뜻의 표현은 400 `duplicate`(초안과 같은 정규화). 유형별 개수는 강제하지 않는다(안내 `TYPE_THIN_*` 만).
 * - 문제는 첫 문제의 400 `{field, reason, problems[]}` — `reason` 은 `required|type|min_length|max_length|forbidden_char|secret_like|no_text|not_japanese|enum|unknown_key|count|chars|reading|duplicate|id|empty|engine_name`.
 */
import { ApiError } from '@/modules/infra'
import { checkTopicChunkFields, detectUnsafeTopicText, detectUnsafeUserTopicText, findTopicChunkDuplicate, topicContentWarnings } from '@/modules/conversation'
import { TOPIC_CHUNK_TYPES, type TopicChunkType } from '@/types/topic'
import { TOPIC_SAVE_LIMITS as S, type TopicCreateInput, type TopicSaveChunk, type TopicUpdateInput, type TopicWarningCode } from '@/types/topicWrite'

/** 주제 저장(#57·#171) 분당 한도 — 상황 저장(#163 분당 20)과 같은 값, 키(`topic-write:`)는 따로. 라우트 파일은 Next 가 정한 이름만 export 할 수 있어 여기 둔다. */
export const TOPIC_WRITE_PER_MINUTE = 20

type Level = TopicCreateInput['level']
const LEVELS: readonly string[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const TOP_KEYS = ['title', 'titleJa', 'level', 'description', 'chunks'] as const
const LINE_BREAKS = /[\r\n\t\v\f\u{85}\u{2028}\u{2029}]+/gu
const HANGUL = /[가-힣]/
const JA_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const len = (s: string) => Array.from(s).length

interface Problem {
  field: string
  reason: string
  message: string
}

class Collector {
  readonly list: Problem[] = []
  add(field: string, reason: string, message: string): null {
    this.list.push({ field, reason, message })
    return null
  }
  throwIfAny(): void {
    if (!this.list.length) return
    const p = this.list[0]
    throw new ApiError('VALIDATION', p.message, { field: p.field, reason: p.reason, problems: this.list.map(({ field, reason }) => ({ field, reason })) })
  }
}

const UNSAFE_MESSAGE = {
  CONTROL_CHARS: '보이지 않는 글자나 줄바꿈 문자는 넣을 수 없어요.',
  MARKUP: '꺾쇠(< >)는 쓸 수 없어요.',
  URL: '링크 주소는 넣을 수 없어요.',
  SECRET_LIKE: '비밀번호·키처럼 보이는 글은 넣을 수 없어요.',
} as const

/** 한 줄 글 칸(제목·일본어 제목·설명). `optional` 이면 null·빈 글 → null. */
function lineText(c: Collector, field: string, raw: unknown, label: string, max: number, optional: boolean): string | null {
  if (raw === null || raw === undefined) return optional ? null : c.add(field, 'required', `${label}을(를) 적어 주세요.`)
  if (typeof raw !== 'string') return c.add(field, 'type', `${label}은(는) 글이어야 해요.`)
  const s = raw.replace(LINE_BREAKS, ' ').replace(/ {2,}/g, ' ').trim()
  if (!s) return optional ? null : c.add(field, 'required', `${label}을(를) 적어 주세요.`)
  if (len(s) > max) return c.add(field, 'max_length', `${label}은(는) ${max}자까지 쓸 수 있어요.`)
  const unsafe = detectUnsafeUserTopicText(s)
  if (unsafe) return c.add(field, unsafe === 'SECRET_LIKE' ? 'secret_like' : 'forbidden_char', `${label}에 ${UNSAFE_MESSAGE[unsafe]}`)
  if (!/[\p{L}\p{N}]/u.test(s)) return c.add(field, 'no_text', `${label}에 글자를 적어 주세요.`)
  return s
}

const CHUNK_FIELD: Record<string, 'textJa' | 'reading' | 'meaningKo'> = {
  SURFACE_LEN: 'textJa',
  SURFACE_CHARS: 'textJa',
  READING_LEN: 'reading',
  READING_CHARS: 'reading',
  READING_MISMATCH: 'reading',
  MEANING_CHARS: 'meaningKo',
}
const CHUNK_MESSAGE: Record<string, string> = {
  SURFACE_LEN: `일본어 표현은 1~${S.textJaMax}자로 적어 주세요.`,
  SURFACE_CHARS: '일본어 표현은 가나·한자(숫자)로만 적어 주세요. 괄호·한글·로마자는 쓸 수 없어요.',
  READING_LEN: `읽기는 1~${S.readingMax}자로 적어 주세요.`,
  READING_CHARS: '읽기는 가나로만 적어 주세요.',
  READING_MISMATCH: '읽기가 표현의 가나 부분과 맞지 않아요.',
  MEANING_CHARS: `뜻은 한국어로 1~${S.meaningMax}자 적어 주세요.`,
  ENGINE_NAME: '표현에 쓸 수 없는 이름이 있어요.',
}

function chunkOf(c: Collector, i: number, raw: unknown, allowId: boolean): TopicSaveChunk | null {
  const f = `chunks[${i}]`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return c.add(f, 'type', '기본 표현 모양이 올바르지 않아요.')
  const o = raw as Record<string, unknown>
  for (const k of Object.keys(o)) {
    if (!['chunkType', 'textJa', 'reading', 'meaningKo', ...(allowId ? ['id'] : [])].includes(k)) return c.add(`${f}.${k}`, 'unknown_key', `넣을 수 없는 항목이에요: ${k}`)
  }
  if (o.id !== undefined && (typeof o.id !== 'string' || o.id.length < 1 || o.id.length > 40)) return c.add(`${f}.id`, 'id', '표현 id 형식이 올바르지 않아요.')
  if (!TOPIC_CHUNK_TYPES.includes(o.chunkType as TopicChunkType)) return c.add(`${f}.chunkType`, 'enum', '표현 종류를 골라 주세요.')
  for (const k of ['textJa', 'reading', 'meaningKo'] as const) {
    if (typeof o[k] !== 'string' || !(o[k] as string).trim()) return c.add(`${f}.${k}`, 'required', k === 'reading' ? '읽기를 적어 주세요.' : k === 'textJa' ? '일본어 표현을 적어 주세요.' : '뜻을 적어 주세요.')
  }
  const textJa = (o.textJa as string).trim()
  const reading = (o.reading as string).trim()
  const meaningKo = (o.meaningKo as string).replace(/\s*[,，、]\s*/g, ', ').trim()
  const bad = checkTopicChunkFields(textJa, reading, meaningKo)
  if (bad === 'CONTROL_CHARS' || bad === 'MARKUP' || bad === 'URL' || bad === 'SECRET_LIKE') {
    const where = (['textJa', 'reading', 'meaningKo'] as const).find((k) => detectUnsafeTopicText({ textJa, reading, meaningKo }[k]) !== null) ?? 'textJa'
    return c.add(`${f}.${where}`, bad === 'SECRET_LIKE' ? 'secret_like' : 'forbidden_char', UNSAFE_MESSAGE[bad])
  }
  if (bad === 'ENGINE_NAME') return c.add(f, 'engine_name', CHUNK_MESSAGE.ENGINE_NAME)
  if (bad) return c.add(`${f}.${CHUNK_FIELD[bad] ?? 'textJa'}`, bad === 'SURFACE_LEN' || bad === 'READING_LEN' ? 'max_length' : bad === 'READING_MISMATCH' ? 'reading' : 'chars', CHUNK_MESSAGE[bad] ?? '표현을 확인해 주세요.')
  return { ...(typeof o.id === 'string' ? { id: o.id } : {}), chunkType: o.chunkType as TopicChunkType, textJa, reading, meaningKo }
}

function chunkList(c: Collector, raw: unknown, allowId: boolean): TopicSaveChunk[] | null {
  if (!Array.isArray(raw)) return c.add('chunks', 'type', '기본 표현 목록이 올바르지 않아요.')
  if (raw.length < S.chunksMin || raw.length > S.chunksMax) return c.add('chunks', 'count', `기본 표현은 ${S.chunksMin}~${S.chunksMax}개로 저장할 수 있어요.`)
  const out = raw.map((x, i) => chunkOf(c, i, x, allowId))
  if (out.some((x) => x === null)) return null
  const chunks = out as TopicSaveChunk[]
  const dup = findTopicChunkDuplicate(chunks)
  if (dup) return c.add(`chunks[${dup.index}].${dup.reason === 'DUP_SURFACE' ? 'textJa' : 'meaningKo'}`, 'duplicate', dup.reason === 'DUP_SURFACE' ? '같은 일본어 표현이 이미 있어요.' : '같은 뜻의 표현이 이미 있어요.')
  return chunks
}

function fieldsOf(c: Collector, o: Record<string, unknown>, mode: 'create' | 'update'): TopicUpdateInput {
  for (const k of Object.keys(o)) if (!(TOP_KEYS as readonly string[]).includes(k)) c.add(k, 'unknown_key', `넣을 수 없는 항목이에요: ${k}`)
  const v: TopicUpdateInput = {}
  const create = mode === 'create'
  if (create || o.title !== undefined) {
    const t = lineText(c, 'title', o.title, '주제 이름', S.titleMax, false)
    if (t !== null) v.title = t
  }
  if (create || o.titleJa !== undefined) {
    const t = lineText(c, 'titleJa', o.titleJa, '일본어 주제 이름', S.titleJaMax, true)
    if (t !== null && (!JA_CHAR.test(t) || HANGUL.test(t))) c.add('titleJa', 'not_japanese', '일본어 주제 이름은 가나·한자로 적어 주세요(한글 없이).')
    else if (!c.list.some((p) => p.field === 'titleJa')) v.titleJa = t
  }
  if (create || o.description !== undefined) {
    const t = lineText(c, 'description', o.description, '주제 설명', S.descriptionMax, true)
    if (!c.list.some((p) => p.field === 'description')) v.description = t
  }
  if (create || o.level !== undefined) {
    if (LEVELS.includes(o.level as string)) v.level = o.level as Level
    else c.add('level', 'enum', '수준을 골라 주세요.')
  }
  if (create || o.chunks !== undefined) {
    const list = o.chunks === undefined ? c.add('chunks', 'required', '기본 표현을 넣어 주세요.') : chunkList(c, o.chunks, !create)
    if (list) v.chunks = list
  }
  return v
}

/** #57 본문 → 저장 입력(검사·정규화를 마친 값). 문제는 400. */
export function parseTopicCreateBody(body: Record<string, unknown>): TopicCreateInput {
  const c = new Collector()
  const v = fieldsOf(c, body, 'create')
  c.throwIfAny()
  return { title: v.title as string, titleJa: v.titleJa ?? null, level: v.level as Level, description: v.description ?? null, chunks: v.chunks as TopicSaveChunk[] }
}

/** #171 본문 → 바꿀 칸만(한 칸 이상). `chunks[].id` 는 기존 표현 유지용. */
export function parseTopicUpdateBody(body: Record<string, unknown>): TopicUpdateInput {
  const c = new Collector()
  if (!Object.keys(body).length) c.add('body', 'empty', '고칠 항목이 없어요.')
  const v = fieldsOf(c, body, 'update')
  c.throwIfAny()
  return v
}

/** 저장한 주제의 안내 코드(저장을 막지 않는다 — 초안과 같은 순서). */
export function topicSaveWarnings(t: { titleJa: string | null; description: string | null; chunks: ReadonlyArray<{ chunkType: string }> }): TopicWarningCode[] {
  return topicContentWarnings(t)
}
