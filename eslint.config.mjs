import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

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
  // ── 6층 import 경계(module-dependency.md §2) — 위→아래로만: app(+admin) → {preferences, conversation, learning, speech} → engine → infra
  // 같은 층·다른 모듈은 index.ts 공개 API 로만(내부 파일 경로 금지). conversation ↔ speech 는 서로 import 하지 않는다(라우트가 조합).
  {
    files: ['src/modules/infra/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/modules/engine', '@/modules/engine/*', '@/modules/speech', '@/modules/speech/*', '@/modules/learning', '@/modules/learning/*', '@/modules/conversation', '@/modules/conversation/*', '@/modules/preferences', '@/modules/preferences/*', '@/modules/admin', '@/modules/admin/*', '@/app/*', '@/components/*'], message: 'infra(L6) 는 상위 층을 import 하지 않는다' }] }] },
  },
  {
    files: ['src/modules/engine/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/modules/speech', '@/modules/speech/*', '@/modules/learning', '@/modules/learning/*', '@/modules/conversation', '@/modules/conversation/*', '@/modules/preferences', '@/modules/preferences/*', '@/modules/admin', '@/modules/admin/*', '@/app/*', '@/components/*', '@/modules/infra/*/*'], message: 'engine(L5) 는 infra 공개 API 만 import 한다' }] }] },
  },
  {
    files: ['src/modules/{preferences,learning}/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/modules/admin', '@/modules/admin/*', '@/app/*', '@/components/*', '@/modules/*/*/*'], message: 'L1~L3 은 admin/app 을 모르고, 다른 모듈은 index 공개 API 로만 import 한다' }] }] },
  },
  {
    files: ['src/modules/conversation/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/modules/speech', '@/modules/speech/*', '@/modules/admin', '@/modules/admin/*', '@/app/*', '@/components/*', '@/modules/*/*/*'], message: 'conversation(L2) 은 speech 를 import 하지 않는다 — 라우트가 조합' }] }] },
  },
  {
    files: ['src/modules/speech/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/modules/conversation', '@/modules/conversation/*', '@/modules/admin', '@/modules/admin/*', '@/app/*', '@/components/*', '@/modules/*/*/*'], message: 'speech(L4) 는 conversation 을 import 하지 않는다 — 라우트가 조합' }] }] },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    // infra 는 예외: 인증(TheMeal 이식)은 `@/modules/infra/auth/oauth/*` 를 그대로 쓰고, 클라이언트 컴포넌트는
    // Prisma 를 끌어오지 않도록 `@/modules/infra/native` 같은 클라이언트 안전 하위 진입점을 쓴다.
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/modules/admin/*', '@/modules/preferences/*', '@/modules/conversation/*', '@/modules/learning/*', '@/modules/speech/*', '@/modules/engine/*'], message: '라우트·화면은 각 모듈의 index 공개 API 만 import 한다(엔진명·spawn·fetch 직접 사용 금지)' }] }] },
  },
])

export default eslintConfig
