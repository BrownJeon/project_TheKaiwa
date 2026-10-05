/**
 * 루트 객체를 한 칸 일찍 닫는 JSON 구문 슬립의 **좁은 결정적 복구**(task-037 — TALK·CHAT 요청 옵트인 `repairRootClose`).
 *
 * 슬립의 모양은 항상 같다: `{"speech":…,"proposals":[]},"userKo":"…"}` — 마지막 필드(`proposals`)를 닫은 뒤 루트의 `}` 를
 * 하나 더 쓰고 그 뒤에 다음 키가 이어진다. `JSON.parse` 는 "루트 뒤 비공백 문자"로 실패한다. 이 함수는 `extractJson` ② 와 같은
 * **전역 코드펜스 토큰 제거**를 거친 텍스트에서 **그 `}` 하나를 지운 문자열**을 돌려준다 — 그래서 문자열 값 안에 ```·```json 이
 * 들어 있으면 그것도 지워진다(슬립과 동시에 나올 확률은 매우 낮고, `correction.original` 은 후검증 `extraCheck` 의 바이트 일치가
 * 막는다 — 위반이면 복구본을 버리고 옛 재시도 경로).
 *
 * 공용 `extractJson`(전 프롬프트 A1~A11)은 건드리지 않는다 — 호출자(`extractAndValidate`)가 `extractJson` 이 **실패했을 때만**,
 * 요청이 옵션을 켰을 때만 이 함수를 부른다. 그래서 정상 응답의 결과는 바이트 단위로 달라질 수 없다(차분 퍼즈로 증명 —
 * `engine/__tests__/repairRootClose.test.ts`).
 *
 * 복구 조건(전부 만족할 때만, 그 밖은 `null`):
 *  1. 코드펜스 토큰을 `extractJson` 과 같은 방식(전역 제거)으로 지운 뒤 **첫 글자가 `{`** (배열 루트·서문 섞인 응답은 다른 모양이다).
 *  2. **문자열 리터럴(따옴표·`\` 이스케이프)을 인식하는 단일 스캔**으로, 괄호 짝이 맞는 채 루트가 **처음 닫히는 위치** `i`
 *     를 찾는다. 문자열 안의 `},"` 는 괄호가 아니라 글자다.
 *  3. `i` 뒤가 `공백* , 공백* "` (= 다음 키)로 시작한다. 그 밖(이미 정상·`{"a":1}}`·`{"a":1},{"b":2}`·루트 뒤 쓰레기)은 null.
 *  4. `i` 의 `}` 를 되돌려 놓은 셈으로 스캔을 이어 갔을 때 루트가 **정확히 한 번 더, 텍스트의 마지막 글자에서** 닫힌다
 *     (두 번 닫힘·괄호 불일치·닫히지 않는 문자열은 null).
 * 복구는 호출당 한 번이다(재귀·반복 없음). 결과가 유효한 JSON 인지는 이 함수가 아니라 호출자의 `JSON.parse`·ajv 가 가린다
 * — 복구가 계약 검증을 느슨하게 만들지 않는다.
 */
export function repairRootClose(text: string): string | null {
  // 문자열이 아닌 입력(어댑터 계약 위반)은 복구 대상이 아니다 — 던지지 않고 null 로 돌려, 옵션을 켠 경로와 끈 경로(extractJson 의
  // TypeError 를 삼켜 parseError)의 오류 의미를 같게 한다.
  if (typeof text !== 'string') return null
  // extractJson ② 와 같은 코드펜스 제거(정상 경로와 같은 입력을 보게 한다).
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  if (cleaned.charCodeAt(0) !== 0x7b) return null

  const stack: string[] = []
  let inString = false
  let escaped = false
  let firstClose = -1

  for (let k = 0; k < cleaned.length; k++) {
    const ch = cleaned[k]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      stack.push('}')
    } else if (ch === '[') {
      stack.push(']')
    } else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null
      if (stack.length > 0) continue
      if (firstClose === -1) {
        // 루트가 처음 닫혔다 — 바로 뒤가 `, "다음 키"` 일 때만 슬립으로 본다.
        if (!/^\s*,\s*"/.test(cleaned.slice(k + 1))) return null
        firstClose = k
        stack.push('}') // 지워질 `}` 를 되돌려 놓은 셈 — 루트는 아직 열려 있다.
        continue
      }
      // 두 번째로 루트가 닫혔다 — 그것이 마지막 글자여야 한다.
      return k === cleaned.length - 1 ? cleaned.slice(0, firstClose) + cleaned.slice(firstClose + 1) : null
    }
  }
  return null
}
