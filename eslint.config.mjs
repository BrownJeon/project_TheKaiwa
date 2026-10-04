import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * 경계 규칙 생성기. `banned` 모듈은 모든 깊이 금지, `indexOnly` 모듈은 index(루트)만 허용하고 하위 경로 금지
 * (`allowSub` 에 적은 하위 진입점은 예외), `banInfraRoot` 는 infra index(= Prisma 포함) 자체를 금지한다.
 * `banRoots` 는 그 밖의 모듈 루트 index 자체를 금지한다(하위 진입점만 허용 — 컴포넌트의 speech, task-003e REV-013).
 * 음성 테스트(2026-09-26): 층별 금지·index 우회·컴포넌트의 infra index import 9건이 모두 error 로 잡히고 허용 경로는 통과.
 */
/**
 * 웹 번들은 네이티브 패키지를 import 하지 않는다(module-dependency §6, task-003f) — 같은 번들이 폰(WebView)과 PC 브라우저에 나가고,
 * 플러그인이 빠진 APK 에서도 화면이 죽지 않아야 한다. 네이티브 기능은 `infra/native/bridge.ts` 가 `window.Capacitor` 전역만 본다.
 * flat config 는 같은 규칙을 뒤 블록이 통째로 덮으므로 모든 경계 블록에 이 패턴을 함께 싣는다(+ 경계 블록 밖 파일용 전역 블록).
 */
const NATIVE_PACKAGES = { regex: '^(@capacitor/|@capacitor-community/|@thekaiwa/sherpa-stt)', message: '웹 번들은 네이티브 패키지를 import 하지 않는다 — @/modules/infra/native 의 bridge 만(module-dependency §6)' }

/**
 * 모듈 경계를 넘는 **상대 경로** import 금지(task-019, REV-034 ⑤ — `../../engine/json/schemaValidate` 가 아래 `@/modules/…` 별칭
 * 패턴을 그대로 통과했다). `no-restricted-imports` 는 import 문자열만 보고 파일 위치를 모르므로 **모듈 루트에서의 깊이 d 마다
 * 블록을 따로** 만든다: 깊이 d 파일에서 `..` 를 d+1 번 오르면 `src/modules`, d+2 번이면 `src` — 거기서 다시 내려가는 경로(다른
 * 모듈·app·components·types)를 막는다. 같은 모듈 안(≤ d 번)은 허용하고, 모듈 밖 저장소 파일(`package.json`·`prisma/seed-data`,
 * d+3 번 올라 루트)도 허용하되 루트에서 `src` 로 되돌아오는 경로는 막는다. 셈을 속일 수 있는 정규화되지 않은 경로
 * (`./x/../../y`·`.././..`)는 통째로 금지. 동적 `import()` 는 이 규칙 대상이 아니다(ESLint 규칙 한계).
 * 테스트(`__tests__/**`·`*.test.ts`)는 다른 모듈 내부를 화이트박스로 import 하는 기존 관례(24건)라 이 패턴만 뺀다 — 별칭 경계는 그대로.
 */
const RELATIVE_MAX_DEPTH = 5
const TEST_FILES = ['**/__tests__/**', '**/*.test.{ts,tsx}']
const NON_NORMALIZED = '^\\.(?=.*(?:/\\.(?:/|$)|/(?!\\.\\.?(?:/|$))[^/]+/\\.\\.(?:/|$)))'
function relativeEscape(depth, message) {
  const msg = `${message} (모듈 밖 상대 경로 금지 — 다른 모듈은 @/modules/<모듈> 공개 API, 그 밖 src 는 @/…)`
  if (depth > RELATIVE_MAX_DEPTH) {
    return [{ regex: '^(?:\\./)?\\.\\.(?:/|$)', message: `${msg} — 모듈 안 ${RELATIVE_MAX_DEPTH}단계보다 깊은 파일은 상위 상대 경로를 쓰지 않는다` }]
  }
  return [
    // 정확히 d+1(→ src/modules/*) 또는 d+2(→ src/*) 번 오른 뒤 끝나거나 내려가는 경로.
    { regex: `^(?:\\./)?(?:\\.\\./){${depth}}(?:\\.\\./)?\\.\\.(?:$|/(?!\\.\\.(?:/|$)))`, message: msg },
    // 저장소 루트까지 올랐다가 src 로 되돌아오는 경로.
    { regex: `^(?:\\./)?(?:\\.\\./){${depth + 3}}src(?:/|$)`, message: msg },
    { regex: NON_NORMALIZED, message: `${msg} — 정규화되지 않은 상대 경로(./x/../..) 금지` },
  ]
}

function boundary(files, banned, indexOnly, message, allowSub = [], banInfraRoot = false, banRoots = []) {
  // 모듈(src/modules/**)은 라우트·화면을 모른다. 라우트는 컴포넌트를 쓰고, 컴포넌트는 라우트를 import 하지 않는다.
  const ui = files.startsWith('src/modules/') ? '^@/(app|components)/' : files.startsWith('src/components/') ? '^@/app/' : null
  const patterns = [NATIVE_PACKAGES, ...(ui ? [{ regex: ui, message }] : [])]
  if (banned.length) patterns.push({ regex: `^@/modules/(${banned.join('|')})(/|$)`, message })
  if (indexOnly.length) {
    const except = allowSub.length ? `(?!(${allowSub.join('|')})(/|$))` : ''
    patterns.push({ regex: `^@/modules/(${indexOnly.join('|')})/${except}`, message: `${message} (index 우회 금지)` })
  }
  if (banInfraRoot) patterns.push({ regex: '^@/modules/infra$', message: `${message} (infra index 는 Prisma 를 포함)` })
  if (banRoots.length) patterns.push({ regex: `^@/modules/(${banRoots.join('|')})$`, message: `${message} (서버 코드가 든 루트 index — 클라이언트 진입점만)` })
  const blocks = [{ files: [files.endsWith('**') ? `${files}/*.{ts,tsx}` : files], rules: { 'no-restricted-imports': ['error', { patterns }] } }]
  // 모듈 블록(`src/modules/<m>/**`)만 — 위 블록을 깊이별 블록이 덮어 상대 경로 패턴을 더한다(테스트 파일은 위 블록 그대로).
  const moduleRoot = /^src\/modules\/[^/]+\/\*\*$/.test(files) ? files.slice(0, -2) : null
  if (moduleRoot) {
    for (let d = 0; d <= RELATIVE_MAX_DEPTH + 1; d++) {
      const glob = d > RELATIVE_MAX_DEPTH ? `${moduleRoot}${'*/'.repeat(d)}**/*.{ts,tsx}` : `${moduleRoot}${'*/'.repeat(d)}*.{ts,tsx}`
      blocks.push({ files: [glob], ignores: TEST_FILES, rules: { 'no-restricted-imports': ['error', { patterns: [...patterns, ...relativeEscape(d, message)] }] } })
    }
  }
  return blocks
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
  // 경계 블록이 덮지 않는 src 파일(proxy.ts·instrumentation.ts·types 등)에도 네이티브 패키지 금지.
  { files: ['src/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', { patterns: [NATIVE_PACKAGES] }] } },
  // ── 6층 import 경계(module-dependency.md §3-1 행렬) ──────────────────────────────────────────
  // `group` 글롭은 `*` 가 `/` 를 넘지 않아 깊이마다 따로 적어야 하고 한 단계만 빠져도 뚫린다(reviewer 2026-09-26 High-1).
  // 그래서 **정규식**으로 "금지 모듈(모든 깊이)" 과 "허용 모듈의 내부 경로(index 우회)" 를 함께 막는다.
  // 같은 모듈 안에서는 상대 경로(./x)를 쓰므로 이 규칙에 걸리지 않는다 — 모듈 밖으로 나가는 상대 경로는 `relativeEscape` 가 막는다(task-019).
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
  // `stt/client` = speech 의 클라이언트 안전 진입점(task-003e M4, Leader 승인 2026-09-28 — module-dependency §3 규칙 5).
  // speech 루트 index(Prisma·engine 포함)는 컴포넌트에서 금지 — 컴포넌트가 쓰는 speech 는 `@/modules/speech/stt/client` 뿐(REV-013).
  // `tts/client` = 클라 재생 큐(TtsPlaybackQueue)·문장 분할 진입점(task-007 B, 같은 규칙 5 — Leader 지시로 stt/client 와 같은 방식).
  // `reading/client` = 후리가나·한글 줄 변환기(task-026 S1 — 화면의 유일한 가나→한글 변환기, 같은 규칙 5).
  ...boundary('src/components/**', ['engine', 'admin', 'conversation', 'learning', 'preferences'], ['speech', 'infra'], '컴포넌트는 서버 모듈을 import 하지 않는다 — 데이터는 라우트가 props 로', ['native', 'dates', 'stt/client', 'tts/client', 'reading/client'], true, ['speech']),
  // speech 클라이언트 진입점은 브라우저 번들에 들어간다 — 서버 코드(다른 모듈·speech 서버 파일·Node/Prisma/Next 서버 API)를 끌어오지 않는다.
  // 허용: 네이티브 브리지(`@/modules/infra/native`)·`@/types/*`·같은 디렉터리 상대 경로. 위 speech 경계 블록을 이 파일들에 한해 대체한다.
  {
    files: ['src/modules/speech/stt/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NATIVE_PACKAGES,
            { regex: '^@/(app|components)/', message: 'speech 클라이언트는 화면을 import 하지 않는다' },
            { regex: '^@/modules/(?!infra/native(/|$))', message: 'speech 클라이언트는 서버 모듈을 import 하지 않는다(네이티브 브리지만 허용)' },
            { regex: '^(?:\\./)?\\.\\.(/|$)', message: 'speech 클라이언트는 speech 서버 파일(상위 경로)을 import 하지 않는다' },
            { regex: NON_NORMALIZED, message: 'speech 클라이언트는 정규화되지 않은 상대 경로(./x/../..)를 쓰지 않는다' },
            { regex: '^(node:|@prisma/|next/(server|headers)$|jsonwebtoken$|jose$)', message: 'speech 클라이언트는 서버 전용 패키지를 import 하지 않는다' },
          ],
        },
      ],
    },
  },
  // TTS 클라이언트 진입점(재생 큐)도 같다. 상위 경로는 순수 문장 분할기 `../sentences` 하나만 허용(다시 듣기를 서버와 같은 경계로 나눈다).
  {
    files: ['src/modules/speech/tts/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NATIVE_PACKAGES,
            { regex: '^@/(app|components)/', message: 'speech 클라이언트는 화면을 import 하지 않는다(오디오·fetch 는 주입)' },
            { regex: '^@/modules/', message: 'TTS 클라이언트는 다른 모듈을 import 하지 않는다' },
            { regex: '^(?:\\./)?\\.\\.(/(?!sentences$)|$)', message: 'TTS 클라이언트는 speech 서버 파일(상위 경로)을 import 하지 않는다 — 순수 ../sentences 만' },
            { regex: NON_NORMALIZED, message: 'TTS 클라이언트는 정규화되지 않은 상대 경로(./x/../..)를 쓰지 않는다' },
            { regex: '^(node:|@prisma/|next/(server|headers)$|jsonwebtoken$|jose$)', message: 'speech 클라이언트는 서버 전용 패키지를 import 하지 않는다' },
          ],
        },
      ],
    },
  },
  // 읽기 표시 변환기(task-026 S1)는 순수 모듈 — 아무것도 import 하지 않는다(타입 `@/types/*` 만). 서버 index 가 이 파일을 쓰는 방향만 있다.
  {
    files: ['src/modules/speech/reading/client.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NATIVE_PACKAGES, { regex: '^(?!@/types/)', message: '읽기 클라이언트는 순수 모듈 — import 하지 않는다(@/types/* 만)' }] }],
    },
  },
])

export default eslintConfig
