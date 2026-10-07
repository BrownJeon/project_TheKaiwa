/**
 * 주제 저장 입력의 구조 검사(task-045 — #174 fork, T2 #57·#171 재사용 가능). DB 칸을 지키는 마지막 방벽이다:
 * 타입·필수·글자 수(코드포인트)·열거·제어문자만 본다. 내용 검사(이모지 접합 문자 허용 변형·꺾쇠·URL·비밀 모양)는
 * 라우트가 conversation 의 주제 검사로 먼저 한다(L3 는 L2 를 import 하지 않는다). 글자를 고치지 않고 앞뒤 공백만 걷는다.
 */
import type { JlptLevel } from '@prisma/client'
import { TOPIC_CHUNK_TYPES, TOPIC_LIMITS as L, type TopicChunkInput, type TopicChunkType, type TopicInput } from '@/types/topic'
import { SCENARIO_LEVELS } from '../scenarios/shape'

export interface TopicFieldProblem {
  field: string
  reason: string
  message: string
}

const KEYS = new Set(['title', 'titleJa', 'level', 'description', 'chunks'])
const CONTROL = /\p{Cc}/u
const len = (s: string) => [...s].length

function textField(problems: TopicFieldProblem[], field: string, v: unknown, label: string, min: number, max: number): string | null {
  if (typeof v !== 'string') {
    problems.push({ field, reason: 'type', message: `${label}을(를) 글로 적어 주세요.` })
    return null
  }
  const s = v.trim()
  if (CONTROL.test(s)) problems.push({ field, reason: 'control_char', message: `${label}에 쓸 수 없는 문자가 있어요.` })
  else if (len(s) < min) problems.push({ field, reason: 'required', message: `${label}을(를) 적어 주세요.` })
  else if (len(s) > max) problems.push({ field, reason: `max ${max}`, message: `${label}은(는) ${max}자까지 적을 수 있어요.` })
  return s
}

/** 빈 글·null 은 null(지움). */
function optionalText(problems: TopicFieldProblem[], field: string, v: unknown, label: string, max: number): string | null {
  if (v === null || (typeof v === 'string' && !v.trim())) return null
  return textField(problems, field, v, label, 0, max)
}

function chunkOf(problems: TopicFieldProblem[], i: number, raw: unknown): TopicChunkInput | null {
  const f = `chunks[${i}]`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push({ field: f, reason: 'type', message: '기본 표현 모양이 올바르지 않아요.' })
    return null
  }
  const o = raw as Record<string, unknown>
  if (!TOPIC_CHUNK_TYPES.includes(o.chunkType as TopicChunkType)) problems.push({ field: `${f}.chunkType`, reason: 'enum', message: '표현 종류를 골라 주세요.' })
  const textJa = textField(problems, `${f}.textJa`, o.textJa, '일본어 표현', 1, L.chunkTextJaMax)
  const reading = o.reading === undefined ? null : optionalText(problems, `${f}.reading`, o.reading, '읽기', L.chunkReadingMax)
  const meaningKo = textField(problems, `${f}.meaningKo`, o.meaningKo, '뜻', 1, L.chunkMeaningMax)
  const note = o.note === undefined ? null : optionalText(problems, `${f}.note`, o.note, '메모', L.chunkNoteMax)
  return { chunkType: o.chunkType as TopicChunkType, textJa: textJa ?? '', reading, meaningKo: meaningKo ?? '', note }
}

/** 보낸 칸만 담는다(빠진 칸은 fork 가 시드 값으로 채운다). 모르는 최상위 키는 400. */
export function normalizeTopicInput(body: Record<string, unknown>): { value: TopicInput; problems: TopicFieldProblem[] } {
  const problems: TopicFieldProblem[] = []
  const value: TopicInput = {}
  for (const k of Object.keys(body)) if (!KEYS.has(k)) problems.push({ field: k, reason: 'unknown_key', message: '알 수 없는 칸이 있어요.' })
  if (body.title !== undefined) value.title = textField(problems, 'title', body.title, '주제 이름', 1, L.titleMax) ?? ''
  if (body.titleJa !== undefined) value.titleJa = optionalText(problems, 'titleJa', body.titleJa, '일본어 주제 이름', L.titleJaMax)
  if (body.description !== undefined) value.description = optionalText(problems, 'description', body.description, '주제 설명', L.descriptionMax)
  if (body.level !== undefined) {
    if (SCENARIO_LEVELS.includes(body.level as JlptLevel)) value.level = body.level as JlptLevel
    else problems.push({ field: 'level', reason: 'enum', message: '수준을 골라 주세요.' })
  }
  if (body.chunks !== undefined) {
    if (!Array.isArray(body.chunks)) problems.push({ field: 'chunks', reason: 'type', message: '기본 표현 목록이 올바르지 않아요.' })
    else if (body.chunks.length < L.chunksMin || body.chunks.length > L.chunksMax)
      problems.push({ field: 'chunks', reason: `range ${L.chunksMin}-${L.chunksMax}`, message: `기본 표현은 ${L.chunksMin}~${L.chunksMax}개까지 둘 수 있어요.` })
    else value.chunks = body.chunks.map((c, i) => chunkOf(problems, i, c)).filter((c): c is TopicChunkInput => c !== null)
  }
  return { value, problems }
}
