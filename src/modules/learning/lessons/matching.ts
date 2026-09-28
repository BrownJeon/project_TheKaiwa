/**
 * 말하기 과제의 목표 표현 확인(task-010 L1) — **LLM 없음**, 코드가 "답에 목표 표현이 들어 있는가"만 느슨하게 본다.
 *
 * 정규화: NFKC → 가타카나→히라가나 → 소문자 → 공백·문장부호·물결표 제거(장음 ー 는 남긴다).
 * 조각(chunk): 표기 또는 읽기가 답에 들어 있으면 사용. 활용을 조금 봐준다 —
 *   ① 끝의 です·でした·ます·ました·ください 를 뗀 핵심(2자 이상)  ② 사전형 끝 가나(う·く·ぐ·す·つ·ぬ·ぶ·む·る·い)를 뗀 어간(2자 이상).
 * 문법(grammar): 문형 표기를 〜·+·/·괄호·로마자 자리표시(N·V 등)에서 나눈 조각이 **모두** 답에 있으면 사용. 문형엔 읽기가 없어
 *   한자가 든 조각은 한자를 건너뛴 가나 조각으로도 본다(でお願いします → でお·いします — 가나로 말해도 인정).
 *   "ます形"·"名詞" 같은 용어 조각과 한글은 버리고, 다른 조각이 있으면 1자 조각(を 등)도 버린다. 남는 조각이 없으면 판정 불가(unknown).
 * 판정 불가는 쓴 표현·못 쓴 표현 어느 쪽에도 넣지 않는다.
 */

export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const STRIP = /[\s　、。，．,.!！?？・「」『』（）()【】〔〕［］[\]〈〉《》…‥~〜～"'“”‘’:：;；-]/g

export function normalizeForMatch(s: string): string {
  return kataToHira(s.normalize('NFKC')).toLowerCase().replace(STRIP, '')
}

const POLITE_ENDINGS = ['でした', 'ください', 'ました', 'です', 'ます']
const DICT_ENDINGS = new Set(['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る', 'い'])
const MIN_CORE = 2

/** 정중형 어미를 뗀 핵심 또는(정중형이 아니면) 사전형 어간. 원형이 늘 첫 번째. */
function cores(normalized: string): string[] {
  const out = [normalized]
  const polite = POLITE_ENDINGS.find((end) => normalized.endsWith(end) && [...normalized].length - [...end].length >= MIN_CORE)
  if (polite) out.push(normalized.slice(0, normalized.length - polite.length))
  else {
    const chars = [...normalized]
    if (chars.length - 1 >= MIN_CORE && DICT_ENDINGS.has(chars[chars.length - 1])) out.push(chars.slice(0, -1).join(''))
  }
  return [...new Set(out.filter(Boolean))]
}

/** 대안 목록 — 대안 하나 = 모두 들어 있어야 하는 조각들. 빈 목록이면 판정 불가. */
export type TargetForms = string[][]

export function chunkForms(textJa: string, reading?: string | null): TargetForms {
  const bases = [normalizeForMatch(textJa), reading ? normalizeForMatch(reading) : ''].filter(Boolean)
  const alts = new Set<string>()
  for (const b of bases) for (const c of cores(b)) alts.add(c)
  return [...alts].map((a) => [a])
}

const TERM_FRAGMENT = /[形詞]$/
const KANJI = /[\u3400-\u9FFF々]/
const KANJI_RUN = /[\u3400-\u9FFF々]+/
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/

export function grammarForms(pattern: string): TargetForms {
  const raw = pattern
    .normalize('NFKC')
    .split(/[〜～~+＋/／・…()（）[\]［］\s]+|[A-Za-z]+/)
    .map((f) => f.trim())
    .filter((f) => f && !HANGUL.test(f) && !TERM_FRAGMENT.test(f))
    .map(normalizeForMatch)
    .filter(Boolean)
  const long = raw.filter((f) => [...f].length >= 2)
  const frags = long.length ? long : raw
  if (!frags.length) return []
  const alts: TargetForms = [frags]
  const last = frags[frags.length - 1]
  const relaxed = cores(last).filter((c) => c !== last)
  for (const r of relaxed) alts.push([...frags.slice(0, -1), r])
  // 문형에는 읽기가 없다 — 한자가 든 조각은 한자 부분을 건너뛴 가나 조각(2자 이상)들로도 본다(お願いします ↔ おねがいします).
  for (const alt of [...alts]) {
    if (!alt.some((f) => KANJI.test(f))) continue
    const kana = alt.flatMap((f) => (KANJI.test(f) ? f.split(KANJI_RUN).filter((p) => [...p].length >= 2) : [f]))
    if (kana.length) alts.push(kana)
  }
  return alts
}

export interface MatchTarget {
  id: string
  forms: TargetForms
}

export interface MatchResult {
  matchedIds: string[]
  missedIds: string[]
  unknownIds: string[]
}

export function matchTargets(text: string, targets: readonly MatchTarget[]): MatchResult {
  const hay = normalizeForMatch(text)
  const out: MatchResult = { matchedIds: [], missedIds: [], unknownIds: [] }
  const seen = new Set<string>()
  for (const t of targets) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    if (!t.forms.length) {
      out.unknownIds.push(t.id)
      continue
    }
    const hit = hay.length > 0 && t.forms.some((alt) => alt.length > 0 && alt.every((f) => hay.includes(f)))
    ;(hit ? out.matchedIds : out.missedIds).push(t.id)
  }
  return out
}
