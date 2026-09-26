import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * 경계 규칙 생성기. `banned` 모듈은 모든 깊이 금지, `indexOnly` 모듈은 index(루트)만 허용하고 하위 경로 금지
 * (`allowSub` 에 적은 하위 진입점은 예외), `banInfraRoot` 는 infra index(= Prisma 포함) 자체를 금지한다.
 * 음성 테스트(2026-09-26): 층별 금지·index 우회·컴포넌트의 infra index import 9건이 모두 error 로 잡히고 허용 경로는 통과.
 */
function boundary(files, banned, indexOnly, message, allowSub = [], banInfraRoot = false) {
  // 모듈(src/modules/**)은 라우트·화면을 모른다. 라우트는 컴포넌트를 쓰고, 컴포넌트는 라우트를 import 하지 않는다.
  const ui = files.startsWith('src/modules/') ? '^@/(app|components)/' : files.startsWith('src/components/') ? '^@/app/' : null
  const patterns = ui ? [{ regex: ui, message }] : []
  if (banned.length) patterns.push({ regex: `^@/modules/(${banned.join('|')})(/|$)`, message })
  if (indexOnly.length) {
    const except = allowSub.length ? `(?!(${allowSub.join('|')})(/|$))` : ''
    patterns.push({ regex: `^@/modules/(${indexOnly.join('|')})/${except}`, message: `${message} (index 우회 금지)` })
  }
  if (banInfraRoot) patterns.push({ regex: '^@/modules/infra$', message: `${message} (infra index 는 Prisma 를 포함)` })
  return [{ files: [files.endsWith('**') ? `${files}/*.{ts,tsx}` : files], rules: { 'no-restricted-imports': ['error', { patterns }] } }]
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    rules: {
      /**
       * `react-hooks/set-state-in-effect` — **error → warn** (2026-09-12, Leader 결정)
       *
       * 이 규칙은 두 가지 서로 다른 패턴을 하나로 뭉뚱그린다(REV-003 Medium-4 분석):
       *
       *  (A) **마운트/의존성 변경 시 데이터 로드** — `void load()` 후 응답으로 setState.
       *      React 공식 문서가 "이 경우엔 Effect 가 필요하다"고 명시한 외부 시스템(네트워크)
       *      동기화다. 이 규칙(실험적, React 컴파일러 계열)이 과민 반응하는 잘 알려진 경우로,
       *      무한 루프·불필요 리렌더 위험이 없다(의존성이 `useCallback` 으로 안정화돼 있다).
       *
       *  (B) **prop 이 바뀔 때 state 를 통째로 리셋** — React 가 피하라고 명시한 패턴.
       *      `key` 기반 리마운트로 고치는 것이 맞다.
       *
       * **왜 warn 인가**: `error` 로 두면 `npm run lint` 가 저장소 전체에서 실패하고(23건,
       * Phase 0~4 전 구간), 그러면 **아무도 lint 를 안 돌린다** — 진짜 오류가 23건 뒤에
       * 묻힌다. 경고로 두면 계속 보이면서도 다른 규칙이 제 역할을 한다.
       *
       * **끄지 않는 이유**: (B) 는 진짜 결함이다. 해당 파일을 손볼 때 `key` 리마운트로
       * 고쳐 나가고, 새로 (B) 를 만들지 않는지 reviewer 가 본다.
       */
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // ── 6층 import 경계(module-dependency.md §3-1 행렬) ──────────────────────────────────────────
  // `group` 글롭은 `*` 가 `/` 를 넘지 않아 깊이마다 따로 적어야 하고 한 단계만 빠져도 뚫린다(reviewer 2026-09-26 High-1).
  // 그래서 **정규식**으로 "금지 모듈(모든 깊이)" 과 "허용 모듈의 내부 경로(index 우회)" 를 함께 막는다.
  // 같은 모듈 안에서는 상대 경로(./x)를 쓰므로 이 규칙에 걸리지 않는다.
  ...boundary('src/modules/infra/**', ['admin', 'preferences', 'conversation', 'learning', 'speech', 'engine'], [], 'infra(L6) 는 상위 층을 import 하지 않는다'),
  ...boundary('src/modules/engine/**', ['admin', 'preferences', 'conversation', 'learning', 'speech'], ['infra'], 'engine(L5) 는 infra 공개 API 만 import 한다'),
  ...boundary('src/modules/preferences/**', ['admin', 'conversation', 'learning', 'speech', 'engine'], ['infra'], 'preferences(L1) 는 infra 만 import 한다'),
  ...boundary('src/modules/learning/**', ['admin', 'conversation', 'speech'], ['preferences', 'engine', 'infra'], 'learning(L3) 은 conversation·speech 를 import 하지 않는다 — 라우트가 조합'),
  ...boundary('src/modules/conversation/**', ['admin', 'speech'], ['learning', 'preferences', 'engine', 'infra'], 'conversation(L2) 은 speech 를 import 하지 않는다 — 라우트가 조합'),
  // speech 클라이언트 코드는 네이티브 브리지(`@/modules/infra/native`, 클라이언트 안전 진입점)만 예외로 허용
  ...boundary('src/modules/speech/**', ['admin', 'conversation', 'learning'], ['preferences', 'engine', 'infra'], 'speech(L4) 는 conversation·learning 을 import 하지 않는다 — 라우트가 조합', ['native']),
  ...boundary('src/modules/admin/**', [], ['preferences', 'conversation', 'learning', 'speech', 'engine', 'infra'], 'admin 은 각 모듈의 index 공개 API 로만 import 한다'),
  // 라우트: engine 직접 import 금지(규칙 4, admin 경유). infra 는 auth·native·dates·jwt·session 만 하위 경로 허용(TheMeal 인증 이식).
  ...boundary('src/app/**', ['engine'], ['admin', 'preferences', 'conversation', 'learning', 'speech', 'infra'], '라우트는 모듈 index 공개 API 만 — engine 은 admin 경유', ['auth', 'native', 'dates', 'jwt', 'session']),
  // app 안의 클라이언트 컴포넌트는 `*.client.tsx` 로 이름 짓는다(VoiceVault KeyboardInset.client.tsx 관례) — 이 파일들은
  // infra index(Prisma 재export)를 import 할 수 없다(reviewer 재검증 Medium-5). flat config 는 뒤 블록이 규칙을 통째로 덮으므로 같은 인자에 banInfraRoot 만 더한다.
  ...boundary('src/app/**/*.client.tsx', ['engine'], ['admin', 'preferences', 'conversation', 'learning', 'speech', 'infra'], '클라이언트 컴포넌트는 서버 모듈을 import 하지 않는다', ['auth/oauth/next-path', 'native', 'dates'], true),
  // 컴포넌트: 서버 모듈(Prisma 포함 infra index·auth)을 끌어오지 않는다(규칙 5). 클라이언트 안전 진입점만.
  ...boundary('src/components/**', ['engine', 'admin', 'conversation', 'learning', 'preferences'], ['speech', 'infra'], '컴포넌트는 서버 모듈을 import 하지 않는다 — 데이터는 라우트가 props 로', ['native', 'dates'], true),
])

export default eslintConfig
