/**
 * 오늘의 회화 «조각» 단계의 결정적 검증·정리(task-081, screens.md 37-12-3·37-12-4) — **이 파일이 규칙의 유일한 소유자**다.
 *
 * 하는 일(전부 순수 함수, DB·LLM 없음):
 *  ① `checkPieces(lineJa, pieces)` — 한 줄의 조각 배열이 6규칙을 지키는지 본다(어긴 규칙 이유 포함). `validatePieces` 는 그 결과를 «정리된 배열 | null» 로 줄인 것.
 *  ② `scanLessonPieces(dialogue)` — 줄마다 ① 을 돌려 «위반 줄 수 × 2 > 줄 수» 레슨 임계를 판정한다(재시도 판정: `checks.ts`).
 *  ③ `applyLessonPieces(dialogue)` — 줄 단위로 **제자리 정리**: 통과한 줄은 정리된 배열, 못 넘은 줄은 `null`. 재시도 뒤에도 임계를 넘는 «부드러운 위반»(Leader 결정 37-18-1 ⑥)을
 *     «레슨 실패» 가 아니라 «그 줄만 null 저장» 으로 표현하는 방법이 이것이다 — 요청의 `extraCheck`(L2)가 최종 응답을 이 함수로 정리해 돌려주므로 저장 단계는 이미 검증된 내용을 받는다.
 *
 * **6규칙(37-12-3)**
 *  1. 배열 길이 1~24, 각 `ja` 1~40 코드포인트.
 *  2. «같음»: `pieces.map(ja).join('').normalize('NFC') === lineJa.normalize('NFC')` — NFC 외 관용 없음(공백·문장부호·전각/반각·장음 기호 모두 글자로 셈, 읽기·후리가나는 비교 대상 아님).
 *  3. `type` 은 6값 또는 null. `type === null` ⇔ `ja` 가 문장부호·기호·공백뿐(`/^[\p{P}\p{S}\p{Z}\s]+$/u`).
 *  4. `type !== null` ⇒ `ko` 가 공백을 뗀 뒤 1~30 코드포인트. `type === null` ⇒ `ko` 는 null 로 저장(빈 문자열·공백·비어 있지 않은 글도 null 로).
 *  5. `type !== null` 조각이 한 줄에 1개 이상.
 *  6. `slash` 는 정리한다(위반 아님) — 아래 «PE 확정 1».
 *
 * **PE 확정 1 — slash 정리(37-18-1 «세부 slash 규칙은 PE 가 확정»)**: 저장 모양은 `slash?: true`(false 는 키를 지운다). 스펙의 «줄 마지막 조각엔 붙지 않는다» 를 한 걸음 넓혀
 * **«그 조각 뒤에 type 이 있는 조각이 하나도 없으면(= 뒤가 비었거나 문장부호 조각뿐이면) slash 를 지운다»** 로 정했다. 「…ください ／ 。」 처럼 끊으면 문장부호만 든 «빈 구간» 이 생겨
 * 화면의 [구간 듣기]·구간 낭독이 소리 없는 구간을 만들기 때문이다(37-12-6 `phraseText` 가 «끝의 type null 조각 제외» 로 이미 방어하지만 저장 단계에서 없애는 쪽이 더 단순하다).
 * 이 정리는 멱등이다(정리된 배열을 다시 넣어도 같은 결과).
 *
 * **PE 확정 3 — slash 를 명사에서 조사로 옮김(task-081 PE 3단계, 눈가림 G6 «어색» 원인 ④: 「写真 ／ を ／ 撮りましたか」)**: 끊어 읽기는 «조사까지 붙인 덩어리 뒤» 여야 한다(screens.md 37-12-5).
 * **`slash` 가 켜진 조각(type 있음) 바로 뒤가 LINK 조각이면 그 slash 를 LINK 연속 구간의 끝 조각으로 옮긴다**(같은 구간 안 다른 LINK 의 slash 는 접는다). 조각 글·순서·종류는 불변이라
 * «같음»(규칙 2)과 위반 판정에 영향이 없고(줄이 null 이 되지 않는다), 옮긴 slash 가 줄 끝(뒤에 type 있는 조각이 없음)에 닿으면 아래 꼬리 정리가 지운다. type null 조각(문장부호)의 slash 는 문장·쉼표 경계라 건드리지 않는다
 * (문장 첫머리 접속 「でも」 가 LINK 로 잘못 분류돼도 앞 문장 경계가 밀리지 않는다). 멱등. 옮긴(접은 것 포함) 수는 `slashMoved` 로 센다 — 계측 `toolLog`/하네스 지표.
 *
 * **PE 확정 2 — 의도적으로 검사하지 않는 것**: `ko` 에 한글이 있는지(일본어 베낌), 한 문장 2~4 구간 권장, 종류 판정의 옳고 그름 — 결정적으로 가를 수 없고 재시도만 늘린다. 한글 없는 `ko` 는
 * 라이브 측정 지표(`koNoHangul`)로만 센다. 종류가 틀렸는지는 사람이 눈가림 표로 판정한다(`tests/prompts/lesson-pieces-live.ts`).
 *
 * **로그 규칙**: 이 파일의 위반 문구는 줄 번호·규칙·글자 수·위치뿐이다 — 레슨 글(사용자가 붙여넣은 원문에서 온 것일 수 있다)을 문구에 싣지 않는다(엔진이 위반 문구를 로그에 남긴다).
 *
 * **6층**: 이 파일은 L2 `conversation` 소유다. L3 `learning` 은 L2 를 import 하지 않으므로(module-dependency §3·§4-4) 학습 모듈이 같은 함수를 직접 쓰지 못한다 — 대신 요청의
 * `extraCheck` 가 최종 응답을 이 함수로 정리하므로 저장되는 `dialogue[i].pieces` 는 이미 «정리된 배열 | null» 이다. 학습 모듈이 방어용으로 같은 규칙을 한 번 더 두려면 로컬 복사본을 두고
 * `tests/prompts/fixtures/lesson-pieces-cases.json` 을 같은 시험으로 돌려 두 벌을 묶는다.
 */
import { LESSON_PIECE_JA_MAX, LESSON_PIECE_KO_MAX, LESSON_PIECES_MAX, LESSON_PIECES_MIN, PIECE_TYPES, type DialoguePiece, type PieceType } from './schemas'

const PUNCT_ONLY_RE = /^[\p{P}\p{S}\p{Z}\s]+$/u
const HANGUL_RE = /[가-힣]/
const PIECE_TYPE_SET: ReadonlySet<string> = new Set(PIECE_TYPES)

/** 코드포인트 수(서로게이트 쌍을 한 글자로 센다 — 스펙의 «코드포인트»). */
function cpLen(s: string): number {
  return Array.from(s).length
}

/** `ja` 가 문장부호·기호·공백뿐인지(= `type` 이 null 이어야 하는 조각). 빈 문자열은 false. */
export function isPunctuationOnly(ja: string): boolean {
  return PUNCT_ONLY_RE.test(ja)
}

export type PiecesViolationReason =
  | 'null_line' // 이미 null 인 줄(정리 뒤 다시 훑을 때)
  | 'not_array'
  | 'count' // 규칙 1 — 길이
  | 'ja_length' // 규칙 1 — 조각 글자 수
  | 'piece_shape' // 조각이 객체가 아니거나 ja 가 문자열이 아님
  | 'join_mismatch' // 규칙 2
  | 'type_invalid' // 규칙 3 — 6값·null 밖
  | 'type_null_mismatch' // 규칙 3 — null ⇔ 문장부호뿐
  | 'ko_invalid' // 규칙 4
  | 'no_typed_piece' // 규칙 5

export const PIECES_VIOLATION_REASONS: readonly PiecesViolationReason[] = [
  'null_line', 'not_array', 'count', 'ja_length', 'piece_shape', 'join_mismatch', 'type_invalid', 'type_null_mismatch', 'ko_invalid', 'no_typed_piece',
]

export interface PiecesCheckOk {
  ok: true
  /** 정리된 조각(ko 앞뒤 공백 제거·type null 의 ko 는 null·slash false 는 키 없음·꼬리 slash 지움). */
  pieces: DialoguePiece[]
  /** 이 줄에서 `ko` 에 한글이 하나도 없는 type 있는 조각 수(검사하지 않고 세기만 한다 — PE 확정 2). */
  koNoHangul: number
  /** 이 줄에서 명사 등 «조사 앞» 조각에서 조사 조각으로 옮기거나 접은 slash 구간 수(PE 확정 3). */
  slashMoved: number
}
export interface PiecesCheckFail {
  ok: false
  reason: PiecesViolationReason
  /** 문제의 조각 번호(0부터) — 줄 전체 문제면 없음. */
  index?: number
  /** 줄 번호가 빠진 사람 읽는 규칙 문장(글 내용 없음). 줄 번호는 `scanLessonPieces` 가 붙인다. */
  detail: string
}

/**
 * PE 확정 3 — `slash` 가 켜진 조각(type 있음) 바로 뒤가 LINK 면 slash 를 LINK 연속 구간의 마지막 조각으로 옮긴다. 제자리에서 바꾸고 옮긴 구간 수를 돌려준다.
 * 구간 안의 다른 조각(처음 조각·중간 LINK)의 slash 는 지운다(접는다). 글·순서·type·ko 는 건드리지 않는다.
 */
function moveSlashOntoParticles(out: DialoguePiece[]): number {
  let moved = 0
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].slash !== true || out[i].type === null) continue
    if (out[i + 1].type !== 'LINK') continue
    let j = i + 1
    while (j + 1 < out.length && out[j + 1].type === 'LINK') j++
    for (let k = i; k < j; k++) delete out[k].slash
    out[j].slash = true
    moved++
    i = j // 다음 반복은 j+1 부터 — out[j] 는 구간 끝이라 뒤가 LINK 가 아니다
  }
  return moved
}

/** 한 줄의 조각을 6규칙으로 검사하고 정리한다. `pieces` 는 `unknown` 으로 받는다(LLM 출력·저장 JSON 어느 쪽도). */
export function checkPieces(lineJa: string, pieces: unknown): PiecesCheckOk | PiecesCheckFail {
  if (pieces === null) return { ok: false, reason: 'null_line', detail: 'pieces 가 null 이다' }
  if (!Array.isArray(pieces)) return { ok: false, reason: 'not_array', detail: 'pieces 는 배열이어야 한다' }
  if (pieces.length < LESSON_PIECES_MIN || pieces.length > LESSON_PIECES_MAX) {
    return { ok: false, reason: 'count', detail: `pieces 는 ${LESSON_PIECES_MIN}~${LESSON_PIECES_MAX}개여야 한다(지금 ${pieces.length}개)` }
  }
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i] as { ja?: unknown } | null
    if (p === null || typeof p !== 'object' || typeof p.ja !== 'string') {
      return { ok: false, reason: 'piece_shape', index: i, detail: `pieces[${i}] 는 문자열 ja 를 가진 객체여야 한다` }
    }
    const len = cpLen(p.ja)
    if (len < 1 || len > LESSON_PIECE_JA_MAX) {
      return { ok: false, reason: 'ja_length', index: i, detail: `pieces[${i}].ja 는 1~${LESSON_PIECE_JA_MAX}자여야 한다(지금 ${len}자) — 조각을 더 짧게 나누세요` }
    }
  }
  // 규칙 2 — «같음»
  const joined = (pieces as { ja: string }[]).map((p) => p.ja).join('').normalize('NFC')
  const line = lineJa.normalize('NFC')
  if (joined !== line) {
    const a = [...joined]
    const b = [...line]
    let at = 0
    while (at < a.length && at < b.length && a[at] === b[at]) at++
    return {
      ok: false,
      reason: 'join_mismatch',
      detail: `pieces 의 ja 를 순서대로 이으면 줄의 ja 와 글자 하나까지 같아야 한다(공백·문장부호 포함) — 이은 글 ${a.length}자·줄 ${b.length}자, ${at + 1}번째 글자부터 다르다`,
    }
  }
  // 규칙 3·4
  const out: DialoguePiece[] = []
  let typed = 0
  let koNoHangul = 0
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i] as { ja: string; type?: unknown; ko?: unknown; slash?: unknown }
    const type = p.type === undefined ? null : p.type
    if (type !== null && (typeof type !== 'string' || !PIECE_TYPE_SET.has(type))) {
      return { ok: false, reason: 'type_invalid', index: i, detail: `pieces[${i}].type 은 ${PIECE_TYPES.join('·')} 중 하나이거나 null 이어야 한다` }
    }
    const punct = isPunctuationOnly(p.ja)
    if ((type === null) !== punct) {
      return {
        ok: false,
        reason: 'type_null_mismatch',
        index: i,
        detail: `pieces[${i}]: 글자가 있는 조각은 type 이 있어야 하고(null 불가), 문장부호·기호·공백뿐인 조각은 type 과 ko 를 null 로 둔다`,
      }
    }
    let ko: string | null = null
    if (type !== null) {
      ko = typeof p.ko === 'string' ? p.ko.trim() : ''
      const kl = cpLen(ko)
      if (kl < 1 || kl > LESSON_PIECE_KO_MAX) {
        return { ok: false, reason: 'ko_invalid', index: i, detail: `pieces[${i}].ko 는 type 이 있으면 1~${LESSON_PIECE_KO_MAX}자 한국어 뜻이어야 한다(지금 ${kl}자)` }
      }
      typed++
      if (!HANGUL_RE.test(ko)) koNoHangul++
    }
    out.push({ ja: p.ja, type: type as PieceType | null, ko, ...(p.slash === true ? { slash: true as const } : {}) })
  }
  // 규칙 5
  if (typed < 1) return { ok: false, reason: 'no_typed_piece', detail: 'pieces 에 type 이 있는 조각이 하나는 있어야 한다' }
  // PE 확정 3 — 명사 뒤 slash 를 조사로 옮긴다(꼬리 정리보다 먼저: 옮긴 slash 가 줄 끝에 닿으면 아래에서 지워진다)
  const slashMoved = moveSlashOntoParticles(out)
  // 규칙 6 / PE 확정 1 — 뒤에 type 있는 조각이 없으면 slash 를 지운다(뒤에서부터 훑는다)
  let typedAfter = false
  for (let i = out.length - 1; i >= 0; i--) {
    if (!typedAfter && out[i].slash) delete out[i].slash
    if (out[i].type !== null) typedAfter = true
  }
  return { ok: true, pieces: out, koNoHangul, slashMoved }
}

/** 스펙 시그니처 그대로 — 통과하면 정리된 조각 배열, 못 넘으면 null. */
export function validatePieces(lineJa: string, pieces: unknown): DialoguePiece[] | null {
  const r = checkPieces(lineJa, pieces)
  return r.ok ? r.pieces : null
}

// ── 레슨 단위 ────────────────────────────────────────────────────────────────

export interface LinePiecesResult {
  /** `dialogue` 안의 줄 번호(0부터). */
  index: number
  result: PiecesCheckOk | PiecesCheckFail
}
export interface LessonPiecesScan {
  /** 줄 수(= `dialogue.length`) — 임계의 분모. */
  total: number
  lines: LinePiecesResult[]
  /** 규칙을 못 넘은 줄 수. */
  invalid: number
  /** «위반 줄 수 × 2 > 줄 수» — 참이면 레슨 위반(재시도 대상, 마지막 시도에서는 면책). */
  overThreshold: boolean
}

/** 레슨 임계(37-12-4): «위반 줄 수 × 2 > 줄 수». 줄이 없으면(0) 위반이 아니다. */
export function piecesOverThreshold(invalidLines: number, totalLines: number): boolean {
  return invalidLines * 2 > totalLines
}

/** 비파괴 — 모든 줄을 검사해 임계를 판정한다. `dialogue[i].pieces` 가 없는(키 없음) 줄은 `not_array` 로 센다. */
export function scanLessonPieces(dialogue: readonly { ja: string; pieces?: unknown }[]): LessonPiecesScan {
  const lines: LinePiecesResult[] = dialogue.map((d, index) => ({ index, result: checkPieces(d.ja, d.pieces) }))
  const invalid = lines.filter((l) => !l.result.ok).length
  return { total: dialogue.length, lines, invalid, overThreshold: piecesOverThreshold(invalid, dialogue.length) }
}

/** 재시도 피드백 문구 — 위반 줄마다 한 문장, 최대 `max` 줄(나머지는 «외 N줄»). 글 내용 없음. */
export function piecesViolationMessages(scan: LessonPiecesScan, max = 4): string[] {
  const bad = scan.lines.filter((l): l is LinePiecesResult & { result: PiecesCheckFail } => !l.result.ok)
  const shown = bad.slice(0, max).map((l) => `dialogue[${l.index}].${l.result.detail}`)
  const head = `dialogue 줄 ${scan.total}개 중 ${scan.invalid}개의 pieces 가 규칙을 어겼다(절반을 넘으면 수업을 다시 만든다) — 아래 줄을 고치세요`
  const rest = bad.length > max ? [`그 밖에 ${bad.length - max}줄도 같은 규칙을 어겼다 — 모든 줄에서 «조각의 ja 를 이으면 줄의 ja 와 글자 하나까지 같다» 를 지키세요`] : []
  return [head, ...shown, ...rest]
}

export interface LessonPiecesSummary {
  /** `dialogue` 줄 수 — 로그·계측의 `piecesTotal`. */
  piecesTotal: number
  /** 정리 뒤 `pieces === null` 인 줄 수 — `piecesNullLines`. */
  piecesNullLines: number
  /** 줄에 남은 조각 수 합(정상 줄만). */
  pieceCount: number
  /** null 이 된 줄의 이유별 수. */
  byReason: Partial<Record<PiecesViolationReason, number>>
  /** `ko` 에 한글이 없는 type 있는 조각 수(검사하지 않고 센다). */
  koNoHangul: number
  /** 조사 앞 조각에서 조사 조각으로 옮기거나 접은 slash 구간 수의 합(PE 확정 3) — `slashMoved`. */
  slashMoved: number
}

/**
 * **제자리 정리** — 통과한 줄은 `checkPieces` 가 정리한 배열로, 못 넘은 줄은 `null` 로 바꾼다. 멱등. `extraCheck` 가 위반 없이 응답을 받아들이기 직전에 부른다(레슨 임계 이하 정상 경로와
 * 마지막 시도 면책 경로 모두). 반환은 계측용 요약뿐이다.
 */
export function applyLessonPieces(dialogue: { ja: string; pieces?: unknown }[]): LessonPiecesSummary {
  const summary: LessonPiecesSummary = { piecesTotal: dialogue.length, piecesNullLines: 0, pieceCount: 0, byReason: {}, koNoHangul: 0, slashMoved: 0 }
  for (const line of dialogue) {
    const r = checkPieces(line.ja, line.pieces)
    if (r.ok) {
      line.pieces = r.pieces
      summary.pieceCount += r.pieces.length
      summary.koNoHangul += r.koNoHangul
      summary.slashMoved += r.slashMoved
    } else {
      line.pieces = null
      summary.piecesNullLines++
      summary.byReason[r.reason] = (summary.byReason[r.reason] ?? 0) + 1
    }
  }
  return summary
}
