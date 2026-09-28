/**
 * 강사 페르소나 로더 — `.claude/agents/tutor.md` **한 파일**이 정본이다(앱 런타임 `--agents` 와 Claude Code 세션 공용,
 * bjj `gymMasterPersona.js` 이식). 원칙:
 *  - mtime+size 캐시. 읽기 실패·본문 비었음·필수 절 누락이면 **마지막 성공 캐시**로, 캐시도 없으면 사용자 언어 오류.
 *    빈 페르소나로 강사를 띄우지 않는다(일반 챗봇이 되는 것은 오류보다 나쁘다 — 사용자가 알 수 없다).
 *  - `--agents` JSON 에 model 을 싣지 않는다(`--model` 이 권위). frontmatter `model:` 은 Claude Code 세션 전용.
 *  - 절 필터(`## N.`)와 **행 필터**: 난이도 표(§4)는 학습자 수준 행만, 모드 표(§6)는 이번 모드 행만 남긴다 —
 *    TALK 예산(design-spec §8 A1 페르소나 ≤2,500자)을 파일 수정 없이 맞추기 위해서다.
 *
 * 경로: 미러·릴리스 모두 cwd 가 프로젝트 루트라 `<cwd>/.claude/agents/tutor.md`(sync-local 이 미러에 복사). `TUTOR_PERSONA_PATH` 로 덮을 수 있다.
 */
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const AGENT_NAME = 'tutor'
export const REQUIRED_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const MIN_BODY_CHARS = 3_000

export class PersonaUnavailableError extends Error {
  readonly userMessage = '선생님 정보를 불러오지 못했어요 — 잠시 후 다시 시도해 주세요.'
  constructor(message: string) {
    super(message)
    this.name = 'PersonaUnavailableError'
  }
}

export function personaPath(): string {
  return process.env.TUTOR_PERSONA_PATH?.trim() || join(process.cwd(), '.claude', 'agents', 'tutor.md')
}

/** 아주 작은 frontmatter 파서 — 첫 콜론에서만 자른다(description 에 콜론이 들어온다). */
export function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const text = raw.replace(/^﻿/, '')
  if (!text.startsWith('---')) return { frontmatter: {}, body: text.trim() }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: {}, body: text.trim() }
  const head = text.slice(text.indexOf('\n') + 1, end)
  const body = text.slice(end + 4).replace(/^\r?\n/, '')
  const frontmatter: Record<string, string> = {}
  for (const line of head.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i <= 0 || line.trimStart().startsWith('#')) continue
    let value = line.slice(i + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    frontmatter[line.slice(0, i).trim()] = value
  }
  return { frontmatter, body: body.trim() }
}

/** `## N.` 로 시작하는 절을 번호별로 나눈다. 첫 절 앞의 서문은 0번. */
export function splitSections(body: string): Map<number, string> {
  const out = new Map<number, string>()
  const re = /^## (\d+)\./gm
  const marks: { n: number; at: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) marks.push({ n: Number(m[1]), at: m.index })
  out.set(0, body.slice(0, marks[0]?.at ?? body.length).trim())
  marks.forEach((mk, i) => out.set(mk.n, body.slice(mk.at, marks[i + 1]?.at ?? body.length).trim()))
  return out
}

/** 마크다운 표에서 머리행·구분행과 `keep(첫 셀)` 이 true 인 행만 남긴다. 표 밖 줄은 그대로. */
export function filterTableRows(section: string, keep: (firstCell: string) => boolean): string {
  const lines = section.split('\n')
  const out: string[] = []
  let rowIndex = -1
  for (const line of lines) {
    if (!line.startsWith('|')) {
      rowIndex = -1
      out.push(line)
      continue
    }
    rowIndex++
    if (rowIndex <= 1) {
      out.push(line) // 머리행·구분행
      continue
    }
    const first = line.split('|')[1]?.trim() ?? ''
    if (keep(first)) out.push(line)
  }
  return out.join('\n')
}

interface Cache {
  mtimeMs: number
  size: number
  description: string
  sections: Map<number, string>
  bodyChars: number
}
let cache: Cache | null = null

function readFresh(): Cache {
  const path = personaPath()
  let stat
  try {
    stat = statSync(path)
  } catch (e) {
    throw new PersonaUnavailableError(`페르소나 파일 stat 실패(${path}): ${(e as Error).message}`)
  }
  if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return cache
  const raw = readFileSync(path, 'utf8')
  const { frontmatter, body } = parseFrontmatter(raw)
  const sections = splitSections(body)
  const missing = REQUIRED_SECTIONS.filter((n) => !sections.has(n))
  if (missing.length > 0) throw new PersonaUnavailableError(`페르소나 필수 절 누락: ${missing.join(', ')}`)
  if (body.length < MIN_BODY_CHARS) throw new PersonaUnavailableError(`페르소나 본문이 너무 짧음(${body.length}자 < ${MIN_BODY_CHARS})`)
  const next: Cache = { mtimeMs: stat.mtimeMs, size: stat.size, description: frontmatter.description || 'Lingofy Japanese 일본어 선생님', sections, bodyChars: body.length }
  cache = next
  console.info(`[persona] tutor.md 로드 — ${body.length}자`)
  return next
}

function load(): Cache {
  try {
    return readFresh()
  } catch (e) {
    if (cache) {
      console.error('[persona] 페르소나 다시 읽기 실패 — 마지막 캐시 사용:', (e as Error).message)
      return cache
    }
    if (e instanceof PersonaUnavailableError) throw e
    throw new PersonaUnavailableError(`페르소나 읽기 실패: ${(e as Error).message}`)
  }
}

export interface PersonaOptions {
  /** 포함할 절 번호. 생략하면 1~8 전부(9 는 Claude Code 세션용이라 런타임에 싣지 않는다). */
  sections?: readonly number[]
  /** §4 난이도 표에서 남길 수준(N5~N1). 생략하면 표 전체. */
  level?: string
  /** §6 모드 표에서 남길 모드(TALK·CHAT·REVIEW…). 생략하면 표 전체. */
  mode?: string
}

export interface LoadedPersona {
  name: string
  description: string
  prompt: string
}

export function loadPersona(opts: PersonaOptions = {}): LoadedPersona {
  const c = load()
  const wanted = opts.sections ?? [1, 2, 3, 4, 5, 6, 7, 8]
  const parts: string[] = []
  for (const n of wanted) {
    let sec = c.sections.get(n)
    if (!sec) continue
    if (n === 4 && opts.level) sec = filterTableRows(sec, (cell) => cell.startsWith(opts.level!))
    if (n === 6 && opts.mode) sec = filterTableRows(sec, (cell) => cell === opts.mode)
    parts.push(sec)
  }
  return { name: AGENT_NAME, description: c.description, prompt: parts.join('\n\n') }
}

/** 테스트에서 캐시를 버린다. */
export function resetPersonaCache(): void {
  cache = null
}
