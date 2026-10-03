/**
 * Claude CLI(`claude --print`) spawn 어댑터 — TheKaiwa 에서 Claude 를 부르는 **유일한 경로**다
 * (engine/adapters 밖에서 spawn·엔진명 금지). TheMeal `src/lib/ai/claudeCli.ts` 이식 + bjj `claudeCli.js`
 * 의 `--agents`/`--agent`/`--max-turns`/`stream-json` 확장(module-dependency §7).
 *
 * TheKaiwa 차이: 도구는 **전부 끈다**(`--tools ""` — 회화·점검·레슨 모두 텍스트만 생성, MCP 는 Phase 3b),
 * 페르소나는 `--agents {tutor}` + `--agent tutor` 로 주입하되 **agents JSON 에 model 을 싣지 않고 `--model` 이 권위**다
 * (bjj gymMasterPersona 원칙: 둘 다 실으면 CLI 버전에 따라 이기는 쪽이 달라진다).
 *
 * ── 지연 실측(2026-09-27, 우분투, CLI 2.1.222, haiku, decisions/llm-japanese-quality.md) ─────────────────
 *  · 기본 spawn 만으로 'OK' 응답 8.4~10.6s — 전역 설정의 훅 12종·플러그인 12개가 매 spawn 마다 돈다.
 *    `--setting-sources ""` + `--strict-mcp-config`(빈 MCP) + `--no-session-persistence` → 2.5~3.1s.
 *  · haiku 4.5 가 **extended thinking** 으로 돌아 TALK 1회에 출력 10,615토큰(대부분 thinking)·40~120s.
 *    `MAX_THINKING_TOKENS=0` + `--settings {"alwaysThinkingEnabled":false}` → 353토큰·4.6~5.3s.
 *  · `--json-schema` 는 +~1s(5.5~6.3s). 기본은 끄고 프롬프트 스키마 + extractJson + ajv 로 검증한다.
 *  · `--bare` 는 구독(OAuth) 인증을 읽지 않아(API 키 전용) 쓸 수 없다.
 *
 * bjj `backend/src/services/claudeCli.js`(옵션·큐·재시도가 풍부)와
 * TheThinker `src/lib/ai/claude-cli.ts`(TS)를 하나로 합쳤다.
 *
 * ── 보안 결정 세 가지 ────────────────────────────────────────────────────────
 * 1. **argv 배열 spawn만 쓴다.** 셸을 거치지 않으므로(`shell:false` 기본) 사용자 입력
 *    (레시피 URL·파일명·메모)이 아무리 이상해도 명령이 되지 않는다. 문자열 조립 금지.
 * 2. **프롬프트는 기본적으로 stdin으로 보낸다.** argv에 실으면 (a) 단일 인자 한계
 *    `MAX_ARG_STRLEN`(131,072바이트)에 걸리고, (b) 같은 호스트의 다른 프로세스가
 *    `/proc/<pid>/cmdline`으로 프롬프트 전문을 읽을 수 있다. 사용자 식단·사진 경로가
 *    들어가는 프롬프트라 (b)가 더 중요하다.
 * 3. **`--tools` 화이트리스트 + `--permission-mode dontAsk` 두 겹으로 막는다.**
 *    `--tools`는 도구 **이름**만 제한하고 `Read`가 여는 **경로**는 제한하지 않는다. 예전에
 *    쓰던 `bypassPermissions`는 그 경로 검사마저 꺼서, 프롬프트에 섞인 외부 문자열
 *    (SNS 캡션·자막·사진 속 글자)이 지시문처럼 동작하면 `.env`나 다른 사용자의 쿠키까지
 *    읽어 응답에 실어 보낼 수 있었다.
 *
 *    `dontAsk`는 **묻지 않고 거부**한다 — 비대화 모드에서 멈추지 않으면서(그게 원래
 *    `bypassPermissions`를 쓴 이유였다) cwd 밖 읽기를 막는다. 2026-09-12 실측:
 *      · cwd 안(상대·절대 경로) → 읽힌다
 *      · cwd 밖 절대경로 / `../` / **cwd 안에 심어 둔 심볼릭 링크** → 전부 거부
 *      · `WebSearch`는 dontAsk에서 기본 거부라 `--allowedTools WebSearch`로 되살린다
 *      · `--allowedTools "Read(//<절대경로>/**)"`로 **한 디렉터리만** 추가 허용할 수 있고,
 *        그때도 그 밖(`/etc/…`·다른 디렉터리)은 계속 거부된다
 *    → 그래서 **cwd = 읽어도 되는 디렉터리**가 곧 권한 경계다. 비전 호출은 프레임이 있는
 *      사용자별 디렉터리를 cwd로 넘긴다(visionClient). 자세한 근거·대안 비교는
 *      `agent-vault/30-Knowledge/decisions/claude-cli-read-scope.md`.
 *    (`--tools`를 아예 안 주면 CLI 기본값 = 전체 도구다. 이 모듈은 항상 명시한다.)
 *
 * ⚠️ 서버 전용 모듈이다. 클라이언트 컴포넌트에서 import하면 `child_process`가 브라우저
 *    번들에 들어가려다 빌드가 깨진다.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'

import { DEFAULT_WARM_LIMITS, isWanted, prewarm, replenish, take, trackActive, warmKeyOf, type PrewarmOutcome, type WarmLimits, type WarmProcess } from './claudeWarmPool'
import { LlmError } from './homeM4'

// ── 환경 변수 ────────────────────────────────────────────────────────────────

function readCliPath(): string {
  return process.env.CLAUDE_CLI_PATH?.trim() || 'claude'
}

/** 모델 미지정 시 기본값. 실제로는 router 가 task→tier→`runtime.modelByTier` 로 항상 넘긴다. */
export function readDefaultModel(): string {
  return 'sonnet'
}

function readDefaultTimeoutMs(): number {
  const n = Number(process.env.CLAUDE_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : 240_000
}

// ── 오류 ─────────────────────────────────────────────────────────────────────

/** `message`는 서버 로그용 원문, `userMessage`는 화면용 한국어(llmClient와 같은 계약). */
export class ClaudeCliError extends LlmError {
  constructor(message: string, userMessage: string, options?: { cause?: unknown }) {
    super(message, userMessage, options)
    this.name = 'ClaudeCliError'
  }
}

export class ClaudeCliNotFoundError extends ClaudeCliError {
  constructor(cliPath: string, cause?: unknown) {
    super(
      `Claude CLI를 실행할 수 없습니다(경로: ${cliPath}) — 설치 여부와 CLAUDE_CLI_PATH를 확인하세요`,
      'AI 분석 도구를 사용할 수 없습니다. 관리자에게 문의해 주세요.',
      { cause },
    )
    this.name = 'ClaudeCliNotFoundError'
  }
}

export class ClaudeCliTimeoutError extends ClaudeCliError {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    const sec = Math.round(timeoutMs / 1000)
    const label = sec >= 120 ? `${Math.round(sec / 60)}분` : `${sec}초`
    super(
      `claude CLI ${timeoutMs}ms 상한 초과로 중단`,
      `AI 분석이 시간 상한(${label})을 넘겨 중단됐습니다. 잠시 후 다시 시도해 주세요.`,
    )
    this.name = 'ClaudeCliTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

/** `signal` 로 취소됨 — 재시도·폴백 대상이 아니다(name 이 'AbortError'). */
export class ClaudeCliAbortedError extends ClaudeCliError {
  constructor() {
    super('claude CLI 호출 취소', 'AI 요청이 취소됐습니다.')
    this.name = 'AbortError'
  }
}

export class ClaudeCliExecError extends ClaudeCliError {
  readonly exitCode: number | null

  constructor(exitCode: number | null, stderr: string) {
    super(
      `claude CLI 실패(exit=${exitCode ?? 'null'}): ${stderr.slice(0, 500) || 'stderr 없음'}`,
      'AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    )
    this.name = 'ClaudeCliExecError'
    this.exitCode = exitCode
  }
}

// ── argv 조립 ────────────────────────────────────────────────────────────────

/**
 * 허용 도구 화이트리스트 — TheKaiwa 는 **비어 있다**(모든 AI 지점이 텍스트 생성만). 늘리려면 Leader 승인이
 * 필요하다(모듈 헤더 보안 결정 3). Phase 3b 의 MCP `propose_*` 는 `--mcp-config` 로 따로 연다.
 */
export const ALLOWED_TOOLS = [] as const
export type AllowedTool = (typeof ALLOWED_TOOLS)[number]

/** stdin으로 보내도 프롬프트가 무한정 커지면 안 된다 — 비정상 입력의 상한(문자). */
const PROMPT_CHAR_CAP = 200_000
/** argv로 보낼 때의 한계 — `MAX_ARG_STRLEN`(131,072바이트)보다 여유 있게 잡는다. */
const ARGV_PROMPT_BYTE_CAP = 100_000

/**
 * 자식 출력 상한(문자). 없으면 **모델이 폭주할 때 이 서버의 메모리가 먼저 죽는다** —
 * 큐 동시성이 1이라 프로세스는 하나지만, 한 프로세스가 수 GB 를 뱉는 것은 막지 못한다.
 *
 * 넘으면 **잘라서 파싱하지 않고 던진다.** 잘린 JSON 은 "스키마 위반"으로 나타나 원인이
 * 용량이라는 사실을 아무도 모르게 된다(같은 함정을 yt-dlp 메타에서 이미 한 번 밟았다 —
 * [[ingest-toolchain-budgets]]).
 */
const OUTPUT_CHAR_CAP = 4_000_000

export interface ClaudeCliOptions {
  /** 사용할 도구. 생략하면 `--tools ""`(전부 비활성) — 도구 없이 텍스트만 생성한다. */
  tools?: readonly AllowedTool[]
  /** 모델(haiku·sonnet·opus). router 가 tier 로 정해 넘긴다. */
  model?: string
  /** 시스템 프롬프트 전체 교체(`--system-prompt`). 페르소나를 싣는 기본 경로다 — Claude Code 기본(코딩 에이전트) 시스템 프롬프트가 섞이지 않는다. */
  systemPrompt?: string
  /** extended thinking. 기본 false — 켜면 haiku 도 수십 초가 걸린다(실측). 깊은 분석(opus) 에서만 명시적으로 켠다. */
  thinking?: boolean
  /** `--agents` 로 넘길 서브에이전트 정의. **model 키를 넣지 않는다**(buildClaudeArgs 가 검사). */
  agents?: Record<string, { description: string; prompt: string }>
  /** `--agent <name>` — 메인 스레드를 이 에이전트로 실행(페르소나 = 시스템 프롬프트). */
  agent?: string
  /** `--max-turns`. 도구가 없어 1이면 충분하다. */
  maxTurns?: number
  /** `stream-json` 이면 NDJSON 이벤트를 줄 단위로 `onEvent` 에 흘리고 결과 텍스트를 돌려준다(`--verbose` 동반). */
  outputFormat?: 'text' | 'stream-json'
  /** stream-json 이벤트 콜백(첫 토큰 시각·사용량 계측). 예외는 삼킨다. */
  onEvent?: (event: Record<string, unknown>) => void
  /** 구조화 출력 스키마. 객체를 주면 `--json-schema <inline JSON>`으로 넘긴다.
   *  CLI가 강제해 주더라도 **응답 검증은 우리가 다시 한다**(`schemaValidate`) — 모델이
   *  스키마를 지켜도 값이 자리표시자일 수 있고, CLI 버전에 따라 강제 수준이 다르다. */
  jsonSchema?: object
  /** 타임아웃(ms). 생략 시 `CLAUDE_TIMEOUT_MS`(기본 240초). */
  timeoutMs?: number
  /** 작업 디렉터리. **이것이 곧 Read 권한 경계다**(보안 결정 3) — `dontAsk` 에서 도구는
   *  cwd 안만 읽을 수 있다. 비전 호출은 **읽을 이미지가 있는 디렉터리**를 넘긴다
   *  (visionClient). 기본은 OS 임시 디렉터리 — 소스 트리 안에서 도구가 돌지 않게 한다. */
  cwd?: string
  /** cwd 외에 읽기를 허용할 절대 디렉터리(각각 `Read(//<dir>/**)` 로 들어간다).
   *  **꼭 필요할 때만 쓴다** — 여기에 적은 만큼 권한 경계가 넓어진다. 예: 프레임과 원본
   *  사진이 서로 다른 디렉터리에 있을 때. */
  readDirs?: readonly string[]
  /** `batch`는 백그라운드 잡용 — 사용자가 기다리는 `interactive` 뒤로 밀린다. */
  priority?: 'interactive' | 'batch'
  /** 총 시도 횟수(재시도 포함). 기본 interactive 2 / batch 1. */
  maxAttempts?: number
  /**
   * 타임아웃도 재시도 대상으로 본다(기본 false — 사용자가 대화 중 두 배로 기다리지 않게). 시도 수는 `maxAttempts` 가 정한다
   * (배치 기본 1 이라 이 옵션만으로는 재시도되지 않는다). 시도마다 `timeoutMs` 를 새로 쓴다. task 표(engine/router/tasks)가 정한다.
   * 타임아웃 재시도는 워커 슬롯을 놓고 **큐 꼬리로 다시 들어간다**(pump 가 interactive 레인을 먼저 꺼내므로 그 사이 사용자 요청이 먼저 돈다).
   * **제약: `onTextDelta` 와 같이 쓸 수 없다**(1차 부분 delta 가 2차에서 다시 방출된다) — 같이 주면 즉시 `ClaudeCliError`.
   */
  retryOnTimeout?: boolean
  /** 로그용 AI 지점 이름(task 키 — 엔진 층 안 문자열). 프롬프트 원문·학습자 데이터를 넣지 않는다. */
  label?: string
  /** 프롬프트를 argv로 보낸다(디버깅·argv 비교용). 기본 false = stdin. */
  promptInArgv?: boolean
  /**
   * assistant 텍스트 조각 콜백(task-007 K2-2). 주면 `stream-json` + `--include-partial-messages` 로 실행해 생성 중인 텍스트를
   * 조각마다 흘린다(최종 결과는 그대로 `result` 이벤트 기준). 콜백 예외는 삼킨다.
   */
  onTextDelta?: (text: string) => void
  /** 취소(task-007 — 수락이 거절된 턴의 선행 LLM). 큐 대기 중이면 시작하지 않고, 실행 중이면 자식을 죽이고 `ClaudeCliAbortedError`. */
  signal?: AbortSignal
  /** `--include-partial-messages`(stream-json 출력 전용). 보통 `onTextDelta` 가 켠다. */
  includePartialMessages?: boolean
  /** `--input-format stream-json` — 예열 프로세스가 메시지 1줄을 나중에 받는 형식(claudeWarmPool). */
  inputFormat?: 'text' | 'stream-json'
}

function assertPromptSize(prompt: string, promptInArgv: boolean): void {
  if (prompt.length > PROMPT_CHAR_CAP) {
    throw new ClaudeCliError(
      `프롬프트가 너무 깁니다(${prompt.length}자 > ${PROMPT_CHAR_CAP})`,
      '분석할 내용이 너무 많습니다. 범위를 줄여 다시 시도해 주세요.',
    )
  }
  if (promptInArgv) {
    const bytes = Buffer.byteLength(prompt, 'utf8')
    if (bytes >= ARGV_PROMPT_BYTE_CAP) {
      throw new ClaudeCliError(
        `argv 프롬프트가 너무 깁니다(${bytes}바이트 ≥ ${ARGV_PROMPT_BYTE_CAP}) — stdin 모드를 쓰세요`,
        '분석할 내용이 너무 많습니다. 범위를 줄여 다시 시도해 주세요.',
      )
    }
  }
}

function assertTools(tools: readonly string[] | undefined): void {
  if (!tools) return
  for (const t of tools) {
    if (!(ALLOWED_TOOLS as readonly string[]).includes(t)) {
      throw new ClaudeCliError(
        `허용되지 않은 도구입니다: '${t}' (허용: ${ALLOWED_TOOLS.join(', ')})`,
        'AI 요청을 구성하지 못했습니다.',
      )
    }
  }
}

/**
 * 추가 읽기 허용 디렉터리를 검사한다. 권한 규칙 문자열(`Read(//<dir>/**)`)에 그대로 박히므로
 * **글롭 메타문자가 섞이면 의도보다 넓게 열린다** — `*`·`?`·`[`·`{`·`)` 를 거부한다.
 * 상대 경로도 거부한다(규칙의 `//` 접두사가 절대경로를 뜻한다).
 */
function assertReadDir(dir: string): string {
  const d = dir.replace(/\/+$/, '')
  if (!d.startsWith('/') || d.includes('..') || /[*?[\]{})(]/.test(d)) {
    throw new ClaudeCliError(
      `읽기 허용 디렉터리가 올바르지 않습니다: '${dir}' (글롭 문자 없는 절대 경로여야 함)`,
      'AI 요청을 구성하지 못했습니다.',
    )
  }
  return d
}

/**
 * argv를 만든다. **export하는 것은 편의가 아니라 검증 요건이다** — reviewer·QA가 claude를
 * 실제로 띄우지 않고 "셸 조립이 없고, 도구가 화이트리스트이며, 프롬프트가 argv에 없다"를
 * 확인할 수 있어야 한다.
 *
 * 가변 인자(`--tools a b c`)가 뒤에 오면 프롬프트를 삼키므로, argv 모드의 프롬프트는 반드시
 * `--print` 바로 뒤에 둔다(bjj P0-1 실측).
 */
export function buildClaudeArgs(prompt: string, opts: ClaudeCliOptions = {}): string[] {
  assertTools(opts.tools)
  const readDirs = (opts.readDirs ?? []).map(assertReadDir)

  const args = ['--print']
  if (opts.promptInArgv) args.push(prompt)
  // 매 spawn 의 고정비를 없앤다(실측 9s→3s): 사용자·프로젝트 설정(훅·플러그인)과 MCP 서버를 읽지 않고 세션을 저장하지 않는다.
  args.push('--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence')
  if (!opts.thinking) args.push('--settings', '{"alwaysThinkingEnabled":false}')
  if (opts.systemPrompt) args.push('--system-prompt', opts.systemPrompt)
  // bypassPermissions 가 아니다 — 그것은 경로 검사까지 껐다(보안 결정 3).
  args.push('--permission-mode', 'dontAsk')
  args.push('--model', opts.model ?? readDefaultModel())
  // 항상 명시한다 — 생략하면 CLI 기본값이 "전체 도구"다.
  if (opts.tools && opts.tools.length > 0) args.push('--tools', ...opts.tools)
  else args.push('--tools', '')

  // dontAsk 는 cwd 안 읽기만 자동 허용한다. 그 밖은 여기에 적은 것만 열린다.
  const allow: string[] = []
  for (const dir of readDirs) allow.push(`Read(//${dir}/**)`)
  if (allow.length > 0) args.push('--allowedTools', ...allow)

  if (opts.agents) {
    for (const [name, def] of Object.entries(opts.agents)) {
      if ('model' in (def as object)) {
        throw new ClaudeCliError(`--agents.${name} 에 model 을 넣지 마세요 — --model 이 권위입니다`, 'AI 요청을 구성하지 못했습니다.')
      }
    }
    args.push('--agents', JSON.stringify(opts.agents))
  }
  if (opts.agent) args.push('--agent', opts.agent)
  if (opts.maxTurns != null) args.push('--max-turns', String(opts.maxTurns))
  if (opts.jsonSchema) args.push('--json-schema', JSON.stringify(opts.jsonSchema))
  // stream-json 은 `--verbose` 가 없으면 CLI 가 거부한다(bjj P0-3 실측).
  if (opts.outputFormat === 'stream-json') {
    args.push('--output-format', 'stream-json', '--verbose')
    if (opts.includePartialMessages) args.push('--include-partial-messages')
  }
  if (opts.inputFormat === 'stream-json') {
    if (opts.outputFormat !== 'stream-json' || opts.promptInArgv) throw new ClaudeCliError('--input-format stream-json 은 stream-json 출력·stdin 프롬프트에서만 씁니다', 'AI 요청을 구성하지 못했습니다.')
    args.push('--input-format', 'stream-json')
  }
  return args
}

/**
 * 자식 프로세스 env **허용 목록**(task-012c Codex C2 ① — 옛 방식은 부모 env 를 통째로 복사한 뒤 알려진 키만 지우는 블랙리스트라
 * 새 시크릿 env 가 생기면 조용히 새어 나갔다). fail-closed: 아래 이름·`LC_*` 밖의 키는 전부 뺀다.
 * - 구독 인증은 `HOME`(또는 `CLAUDE_CONFIG_DIR`) 아래 CLI 설정·세션 파일이라 인증 env 가 필요 없다. `ANTHROPIC_API_KEY` 도 넘기지 않아
 *   서버 env 에 키가 있어도 과금 경로가 갈리지 않는다.
 * - Claude Code 가 자기 세션에서 주입한 변수(`CLAUDECODE`·`CLAUDE_CODE_ENTRYPOINT`…)는 목록에 없어 자동으로 빠진다 — 남으면 중첩 실행으로 오인.
 * - `NODE_OPTIONS` 는 넘기지 않는다(dev 서버의 inspect·메모리 플래그가 CLI 에 섞이지 않게).
 * - `~/.npm-global/bin` 을 PATH 앞에 붙이는 이유: 시스템 `/usr/bin/claude` 가 구버전일 때 `--json-schema`/`--tools` 동작이 다르다(bjj 실측).
 * - 프록시 env(`HTTP(S)_PROXY`·`ALL_PROXY`·`NO_PROXY`, 대소문자)는 넘기지 않는다(task-019, REV-035 재검 Low) — 값이
 *   `http://user:pass@host` 형태면 자격 증명이 그대로 자식에 간다. 2026-09-29 운영(pm2 thekaiwa·shared/.env)·개발(.env·미러) 어디에도
 *   없음을 확인했다. 필요해지면 `new URL(v)` 로 username/password 를 지운 값만 넘기는 정제를 붙여 다시 넣는다.
 */
export const CHILD_ENV_ALLOW: readonly string[] = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LANGUAGE',
  'TZ',
  'TMPDIR',
  'TMP',
  'TEMP',
  'TERM',
  // 옛 방식에서도 넘어가던 비시크릿 실행 모드 — CLI(Node 앱) 동작을 바꾸지 않으려고 유지.
  'NODE_ENV',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'XDG_RUNTIME_DIR',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  // Claude CLI 가 읽는 비시크릿 설정(설정 디렉터리·자동 업데이트·원격 보고 끄기).
  'CLAUDE_CONFIG_DIR',
  'DISABLE_AUTOUPDATER',
  'DISABLE_TELEMETRY',
  'DISABLE_ERROR_REPORTING',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
]
const CHILD_ENV_ALLOW_SET = new Set(CHILD_ENV_ALLOW)
const CHILD_ENV_LOCALE = /^LC_[A-Z]+$/

/** 순수 함수(단위 테스트 대상) — `source` 에서 허용 목록만 골라 자식 env 를 만든다. */
export function buildChildEnv(source: Readonly<Record<string, string | undefined>>, opts: { thinking: boolean; home: string; npmGlobalBinExists: boolean }): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === 'string' && (CHILD_ENV_ALLOW_SET.has(k) || CHILD_ENV_LOCALE.test(k))) env[k] = v
  }
  if (!env.HOME) env.HOME = opts.home
  // thinking 을 끄는 두 번째 겹 — settings 가 무시되는 CLI 버전에서도 토큰 예산 0 으로 막는다.
  if (!opts.thinking) env.MAX_THINKING_TOKENS = '0'
  const npmGlobalBin = `${opts.home}/.npm-global/bin`
  if (opts.npmGlobalBinExists && env.PATH && !env.PATH.startsWith(npmGlobalBin)) env.PATH = `${npmGlobalBin}:${env.PATH}`
  return env
}

function cleanEnv(thinking = false): NodeJS.ProcessEnv {
  const home = homedir()
  return buildChildEnv(process.env, { thinking, home, npmGlobalBinExists: existsSync(`${home}/.npm-global/bin`) })
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

/** 예열 프로세스가 메시지를 받고도 아무것도 내지 않고 끝났다 — 호출자가 cold 로 다시 띄운다(요청 실패가 아니다). */
export class ClaudeWarmUnusableError extends ClaudeCliError {
  constructor(detail: string) {
    super(`예열 프로세스 사용 불가: ${detail}`, 'AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    this.name = 'ClaudeWarmUnusableError'
  }
}

interface CollectResult {
  text: string
  /** 첫 텍스트 delta 를 받은 시각(Date.now). stream-json 이 아니거나 delta 가 없으면 null. */
  firstDeltaAt: number | null
}

/** stream-json 한 줄에서 assistant 텍스트 조각을 꺼낸다(`--include-partial-messages` 의 content_block_delta/text_delta). */
export function textDeltaOf(ev: Record<string, unknown>): string | null {
  if (ev.type !== 'stream_event') return null
  const inner = ev.event as { type?: unknown; delta?: { type?: unknown; text?: unknown } } | undefined
  if (inner?.type !== 'content_block_delta' || inner.delta?.type !== 'text_delta') return null
  return typeof inner.delta.text === 'string' ? inner.delta.text : null
}

/**
 * 자식 하나의 출력을 끝까지 모은다(cold·예열 공용). spawn·stdin 쓰기는 호출자가 한다.
 * `initial` 은 예열 프로세스가 꺼내지기 전에 낸 출력이다. `warm` 이면 이벤트를 하나도 못 받고 끝난 경우를 사용 불가로 돌린다.
 */
function collect(proc: ChildProcess, cliPath: string, opts: ClaudeCliOptions, timeoutMs: number, initial: { stdout: string; stderr: string } | null, warm: boolean): Promise<CollectResult> {
  return new Promise((resolve, reject) => {
    let out = ''
    let err = initial?.stderr ?? ''
    let settled = false
    let timedOut = false
    let aborted = false
    let sawEvent = false
    let firstDeltaAt: number | null = null

    const onAbort = () => {
      aborted = true
      proc.kill('SIGTERM')
      killTimer = setTimeout(() => proc.kill('SIGKILL'), 5_000)
    }
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(killTimer)
      opts.signal?.removeEventListener('abort', onAbort)
      fn()
    }

    // SIGTERM으로 먼저 정리 기회를 주고, 5초 뒤에도 살아 있으면 SIGKILL로 확실히 죽인다.
    // 남은 claude 프로세스가 쌓이면 M4가 아니라 이 서버의 메모리를 갉아먹는다.
    let killTimer: NodeJS.Timeout = setTimeout(() => {}, 0)
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
      killTimer = setTimeout(() => proc.kill('SIGKILL'), 5_000)
    }, timeoutMs)
    if (opts.signal?.aborted) queueMicrotask(onAbort)
    else opts.signal?.addEventListener('abort', onAbort, { once: true })

    let overflowed = false
    // stream-json 은 NDJSON 이다 — 청크 경계가 줄 경계와 다르므로 줄 버퍼가 필수다(bjj 계약 E).
    const streaming = opts.outputFormat === 'stream-json'
    let lineBuf = ''
    let resultEvent: Record<string, unknown> | null = null
    const feed = (chunk: string) => {
      lineBuf += chunk
      let nl: number
      while ((nl = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.slice(0, nl).trim()
        lineBuf = lineBuf.slice(nl + 1)
        if (!line) continue
        let ev: Record<string, unknown>
        try {
          ev = JSON.parse(line) as Record<string, unknown>
        } catch {
          continue
        }
        sawEvent = true
        if (ev.type === 'result') resultEvent = ev
        const delta = opts.onTextDelta ? textDeltaOf(ev) : null
        if (delta) {
          if (firstDeltaAt === null) firstDeltaAt = Date.now()
          try {
            opts.onTextDelta!(delta)
          } catch {
            /* 조기 추출 콜백 오류는 호출을 실패시키지 않는다 */
          }
        }
        if (opts.onEvent) {
          try {
            opts.onEvent(ev)
          } catch {
            /* 계측 콜백 오류는 호출을 실패시키지 않는다 */
          }
        }
      }
    }
    const onStdout = (s: string) => {
      if (out.length > OUTPUT_CHAR_CAP) {
        if (!overflowed) {
          overflowed = true
          proc.kill('SIGTERM')
        }
        return
      }
      out += s
      if (streaming) feed(s)
    }

    proc.stdout?.on('data', (d: Buffer) => onStdout(d.toString('utf8')))
    proc.stderr?.on('data', (d: Buffer) => {
      // stderr 는 진단용이라 앞부분만 있으면 충분하다.
      if (err.length < 100_000) err += d.toString('utf8')
    })
    if (initial?.stdout) onStdout(initial.stdout)

    proc.on('error', (e: NodeJS.ErrnoException) => {
      finish(() => {
        if (warm && !sawEvent) reject(new ClaudeWarmUnusableError(`spawn error ${e.code ?? ''}`))
        else if (e.code === 'ENOENT' || e.code === 'EACCES') reject(new ClaudeCliNotFoundError(cliPath, e))
        else reject(new ClaudeCliError(`claude CLI 실행 오류: ${e.message}`, 'AI 분석에 실패했습니다.', { cause: e }))
      })
    })

    proc.on('close', (code: number | null) => {
      finish(() => {
        if (aborted) {
          reject(new ClaudeCliAbortedError())
          return
        }
        if (timedOut) {
          reject(new ClaudeCliTimeoutError(timeoutMs))
          return
        }
        if (overflowed) {
          reject(
            new ClaudeCliError(
              `claude 출력이 상한(${OUTPUT_CHAR_CAP}자)을 넘겨 중단`,
              'AI 응답이 너무 길어 처리하지 못했습니다. 범위를 줄여 다시 시도해 주세요.',
            ),
          )
          return
        }
        if (streaming && lineBuf.trim()) feed('\n')
        if (warm && !sawEvent) {
          reject(new ClaudeWarmUnusableError(`exit=${code ?? 'null'} 출력 없음`))
          return
        }
        if (code !== 0 && code !== null) {
          reject(new ClaudeCliExecError(code, err.trim()))
          return
        }
        if (streaming) {
          const ev = resultEvent as Record<string, unknown> | null
          if (!ev) {
            reject(new ClaudeCliExecError(code, err.trim() || 'stream-json result 이벤트 없음'))
            return
          }
          if (ev.is_error === true) {
            reject(new ClaudeCliExecError(code, String(ev.result ?? 'claude 실행 오류').slice(0, 500)))
            return
          }
          // --json-schema 를 쓰면 CLI 가 구조화 결과를 `structured_output` 에 싣는 버전이 있다 — 있으면 그것을 쓴다.
          const structured = ev.structured_output
          const text = structured != null ? JSON.stringify(structured) : typeof ev.result === 'string' ? ev.result.trim() : ''
          if (!text) {
            reject(new ClaudeCliExecError(code, '빈 응답'))
            return
          }
          resolve({ text, firstDeltaAt })
          return
        }
        const trimmed = out.trim()
        // CLI가 exit 0으로 "Execution error"만 뱉는 경우가 있다 — 성공으로 오인하면
        // 그 문자열이 그대로 JSON 파서로 흘러들어가 엉뚱한 스키마 오류로 둔갑한다.
        if (trimmed === 'Execution error' || trimmed.startsWith('Execution error\n')) {
          reject(new ClaudeCliExecError(code, err.trim() || 'Execution error'))
          return
        }
        if (!trimmed) {
          reject(new ClaudeCliExecError(code, err.trim() || '빈 응답'))
          return
        }
        resolve({ text: trimmed, firstDeltaAt })
      })
    })
  })
}

function spawnClaude(cliPath: string, args: string[], opts: ClaudeCliOptions, stdinPiped: boolean): ChildProcess {
  // shell 없이 argv 배열로만 실행한다(모듈 헤더 보안 결정 1). detached 를 쓰지 않는다(서버와 같은 프로세스 그룹).
  return spawn(cliPath, args, {
    cwd: opts.cwd ?? tmpdir(),
    env: cleanEnv(opts.thinking === true),
    stdio: stdinPiped ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  })
}

function runCold(prompt: string, opts: ClaudeCliOptions): Promise<CollectResult> {
  const cliPath = readCliPath()
  const timeoutMs = opts.timeoutMs ?? readDefaultTimeoutMs()
  const promptInArgv = opts.promptInArgv === true
  let args: string[]
  let proc: ChildProcess
  try {
    args = buildClaudeArgs(prompt, opts)
    proc = spawnClaude(cliPath, args, opts, !promptInArgv)
  } catch (e) {
    return Promise.reject(e)
  }
  const untrack = trackActive(proc)
  if (!promptInArgv && proc.stdin) {
    // stdin이 먼저 닫히는 경쟁 상황(프로세스 즉시 종료)에서 EPIPE로 프로세스가 죽지 않게 한다.
    proc.stdin.on('error', () => {})
    proc.stdin.end(prompt, 'utf8')
  }
  return collect(proc, cliPath, opts, timeoutMs, null, false).finally(untrack)
}

/** 예열 프로세스에 user 메시지 1줄을 쓰고 stdin 을 닫는다 — 프로세스당 1요청(세션이 이어지지 않는다). */
function runWarm(w: WarmProcess, prompt: string, opts: ClaudeCliOptions): Promise<CollectResult> {
  const timeoutMs = opts.timeoutMs ?? readDefaultTimeoutMs()
  const untrack = trackActive(w.proc)
  const p = collect(w.proc, readCliPath(), { ...opts, outputFormat: 'stream-json' }, timeoutMs, { stdout: w.stdout, stderr: w.stderr }, true)
  const line = `${JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } })}\n`
  try {
    w.proc.stdin!.end(line, 'utf8')
  } catch {
    w.proc.kill('SIGTERM')
  }
  return p.finally(untrack)
}

/** 예열 프로세스의 argv — 요청 옵션에서 실행 시점 값(타임아웃·레인·콜백)을 빼고 stream-json 입출력을 강제한다. */
function warmArgs(opts: ClaudeCliOptions): string[] {
  return buildClaudeArgs('', {
    tools: opts.tools,
    model: opts.model,
    systemPrompt: opts.systemPrompt,
    thinking: opts.thinking,
    agents: opts.agents,
    agent: opts.agent,
    maxTurns: opts.maxTurns,
    jsonSchema: opts.jsonSchema,
    readDirs: opts.readDirs,
    outputFormat: 'stream-json',
    includePartialMessages: true,
    inputFormat: 'stream-json',
  })
}

function warmKeyFor(opts: ClaudeCliOptions): string | null {
  if (opts.promptInArgv) return null
  try {
    return warmKeyOf(readCliPath(), opts.cwd ?? tmpdir(), warmArgs(opts))
  } catch {
    return null
  }
}

/**
 * 이 옵션으로 곧 올 요청을 위해 CLI 를 미리 띄운다(K2-1). 같은 옵션의 `callClaude*` 가 대기 프로세스를 꺼내 쓴다.
 * 실패해도 던지지 않는다(다음 요청이 cold 로 돈다).
 */
export function prewarmClaude(opts: ClaudeCliOptions, limits: WarmLimits = DEFAULT_WARM_LIMITS): PrewarmOutcome {
  try {
    assertTools(opts.tools)
    const args = warmArgs(opts)
    const cliPath = readCliPath()
    const key = warmKeyOf(cliPath, opts.cwd ?? tmpdir(), args)
    return prewarm(key, () => spawnClaude(cliPath, args, opts, true), limits)
  } catch {
    return 'FAILED'
  }
}

export { warmPoolSnapshot, drainWarmPool } from './claudeWarmPool'
export type { WarmLimits, PrewarmOutcome, WarmPoolSnapshot } from './claudeWarmPool'

// ── 우선순위 2레인 직렬 큐 ────────────────────────────────────────────────────
//
// 동시성은 1이다. Claude CLI는 구독 rate limit을 공유하고 프로세스 하나가 수백 MB를 쓰므로,
// 레슨·평가 잡 여러 건이 동시에 뜨면 서버가 먼저 무너진다. 대신 레인을 둘로 나눠 사용자가
// 기다리는 요청(interactive)이 백그라운드 잡(batch) 뒤에서 굶지 않게 한다.

interface QueueItem<T> {
  task: () => Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
}

const interactiveQueue: QueueItem<unknown>[] = []
const batchQueue: QueueItem<unknown>[] = []
let workerBusy = false

function pump(): void {
  if (workerBusy) return
  const item = interactiveQueue.shift() ?? batchQueue.shift()
  if (!item) return
  workerBusy = true
  item.task().then(
    (result) => {
      workerBusy = false
      item.resolve(result)
      pump()
    },
    (e) => {
      workerBusy = false
      item.reject(e)
      pump()
    },
  )
}

function schedule<T>(priority: 'interactive' | 'batch', task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item = { task, resolve, reject } as QueueItem<unknown>
    if (priority === 'batch') batchQueue.push(item)
    else interactiveQueue.push(item)
    pump()
  })
}

/** 재시도해도 의미가 있는 실패인가 — 일시적 실행 오류만 해당. 타임아웃·설치 누락·프롬프트
 *  크기 초과는 다시 걸어도 같은 결과라 재시도하지 않는다(사용자만 두 배로 기다린다).
 *  단 호출이 `retryOnTimeout` 을 켰으면(백그라운드 판단 잡 — CLI 무응답은 일시적인 경우가 있다) 타임아웃은 재시도한다. */
function isRetryable(e: unknown, opts: ClaudeCliOptions): boolean {
  if (e instanceof ClaudeCliTimeoutError) return opts.retryOnTimeout === true
  if (e instanceof ClaudeCliNotFoundError) return false
  if (e instanceof ClaudeCliExecError) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 타임아웃 재시도를 큐 꼬리로 되돌리는 내부 신호(슬롯을 놓기 위해 task 밖으로 던진다) — 호출자에게는 새지 않는다. */
class RequeueAfterTimeout extends Error {
  constructor(readonly nextAttempt: number) {
    super('requeue-after-timeout')
  }
}

/** `HIT` 예열 프로세스 사용 · `MISS` 원하던 키인데 대기 프로세스 없음(cold) · `FALLBACK` 예열이 못 쓰게 돼 cold · `OFF` 예열 대상 아님. */
export type WarmUse = 'HIT' | 'MISS' | 'FALLBACK' | 'OFF'

export interface ClaudeCallResult {
  text: string
  warm: WarmUse
  /** 실행 시작(큐 통과 후) → 첫 텍스트 delta(ms). `onTextDelta` 가 없거나 delta 가 없으면 null. */
  firstDeltaMs: number | null
}

/**
 * Claude CLI 호출 — 직렬 큐 + 일시적 실패 재시도 + (있으면) 예열 프로세스 사용.
 *
 * 프롬프트에 사용자 데이터가 들어가므로 **로그에 프롬프트를 남기지 않는다**(길이만 남긴다).
 */
export async function callClaudeDetailed(prompt: string, opts: ClaudeCliOptions = {}): Promise<ClaudeCallResult> {
  const priority = opts.priority ?? 'interactive'
  const maxAttempts = opts.maxAttempts ?? (priority === 'batch' ? 1 : 2)
  assertPromptSize(prompt, opts.promptInArgv === true)
  assertTools(opts.tools)
  if (opts.retryOnTimeout && opts.onTextDelta) {
    throw new ClaudeCliError('retryOnTimeout 과 onTextDelta 는 같이 쓸 수 없다(재시도 시 delta 중복 방출)', 'AI 요청을 구성하지 못했습니다.')
  }
  const taskLabel = opts.label ?? '없음'
  const runOpts: ClaudeCliOptions = opts.onTextDelta ? { ...opts, outputFormat: 'stream-json', includePartialMessages: true } : opts
  const key = warmKeyFor(opts)

  const task = async (firstAttempt: number): Promise<ClaudeCallResult> => {
    let lastErr: unknown
    for (let attempt = firstAttempt; attempt <= maxAttempts; attempt++) {
      // 큐에서 기다리는 동안 취소됐으면 프로세스를 쓰지 않는다(예열 프로세스도 꺼내지 않는다).
      if (opts.signal?.aborted) {
        console.info('[claudeCli] 취소 — 시작 전')
        throw new ClaudeCliAbortedError()
      }
      const startedAt = Date.now()
      let warm: WarmUse = 'OFF'
      try {
        let r: CollectResult | null = null
        if (key) {
          const w = take(key)
          if (w) {
            warm = 'HIT'
            try {
              r = await runWarm(w, prompt, runOpts)
            } catch (e) {
              if (!(e instanceof ClaudeWarmUnusableError)) throw e
              warm = 'FALLBACK'
              console.warn(`[claudeCli] 예열 프로세스 사용 불가 → cold`)
            }
          } else if (isWanted(key)) warm = 'MISS'
        }
        if (!r) r = await runCold(prompt, runOpts)
        console.info(
          `[claudeCli] 완료 — task=${taskLabel} model=${opts.model ?? readDefaultModel()} agent=${opts.agent ?? '없음'} ` +
            `promptChars=${prompt.length} elapsed=${Date.now() - startedAt}ms attempt=${attempt} warm=${warm}`,
        )
        return { text: r.text, warm, firstDeltaMs: r.firstDeltaAt === null ? null : r.firstDeltaAt - startedAt }
      } catch (e) {
        lastErr = e
        if (e instanceof ClaudeCliAbortedError) console.info(`[claudeCli] 취소 — elapsed=${Date.now() - startedAt}ms warm=${warm}`)
        if (e instanceof ClaudeCliTimeoutError) {
          // 프롬프트 원문·학습자 데이터는 남기지 않는다(길이만). 재시도 여부도 이 한 줄에 싣는다(일반 '일시적 실패' 줄은 따로 내지 않는다).
          const retrying = attempt < maxAttempts && isRetryable(e, opts)
          console.warn(
            `[claudeCli] 타임아웃 — task=${taskLabel} model=${opts.model ?? readDefaultModel()} promptChars=${prompt.length} ` +
              `timeoutMs=${e.timeoutMs} attempt=${attempt} maxAttempts=${maxAttempts} retry=${retrying ? '예' : '아니오'}`,
          )
          // 슬롯을 쥔 채 기다리지 않는다 — 큐 꼬리로 다시 들어가 interactive 가 먼저 돈다(바깥 drive 가 sleep 후 재진입).
          if (retrying) throw new RequeueAfterTimeout(attempt + 1)
        } else if (attempt < maxAttempts && isRetryable(e, opts)) {
          console.warn(`[claudeCli] 일시적 실패 — task=${taskLabel} ${attempt}/${maxAttempts} 재시도`)
          await sleep(1000 * attempt)
          continue
        }
        throw e
      } finally {
        // 프로세스당 1요청 — 쓴 키는 다음 턴을 위해 다시 채운다(원하던 키만, TTL 안).
        if (key) replenish(key)
      }
    }
    throw lastErr ?? new ClaudeCliError('unreachable', 'AI 분석에 실패했습니다.')
  }

  // 타임아웃 재시도만 슬롯을 놓고 재진입한다. 일시적 실행 오류 재시도(task 안 루프)는 기존대로 슬롯을 유지한다.
  const drive = async (firstAttempt: number): Promise<ClaudeCallResult> => {
    try {
      return await schedule(priority, () => task(firstAttempt))
    } catch (e) {
      if (!(e instanceof RequeueAfterTimeout)) throw e
      await sleep(1000 * (e.nextAttempt - 1))
      return drive(e.nextAttempt)
    }
  }
  return drive(1)
}

/** 텍스트만 필요한 호출자용(기존 계약). */
export async function callClaude(prompt: string, opts: ClaudeCliOptions = {}): Promise<string> {
  return (await callClaudeDetailed(prompt, opts)).text
}

// ── Health 프로브(task-005b #95) ─────────────────────────────────────────────

export interface ClaudeCliProbe {
  ok: boolean
  version: string | null
  errorCode: string | null
  latencyMs: number
}

const VERSION_TOKEN = /^[\w.\-+ ()]{1,60}$/

/**
 * `claude --version` 만 실행한다 — 모델 호출 없음, LLM 큐 밖(사용자 턴을 막지 않는다).
 * 실행 파일은 런타임과 같은 서버 env(`CLAUDE_CLI_PATH`)만 쓴다 — DB connection 의 `binPath` 를 spawn 하지 않는다
 * (관리자 편집 값이 실행 파일이 되는 경로를 만들지 않기 위해). argv 배열·셸 없음·5초 상한·stdout 4KB 상한, stderr 는 버린다.
 */
export function probeClaudeCliVersion(timeoutMs = 5_000): Promise<ClaudeCliProbe> {
  const startedAt = Date.now()
  return new Promise((resolve) => {
    let out = ''
    let settled = false
    // spawn 이 동기로 던지면 타이머 전에 done 이 불린다 — 그래서 핸들을 객체에 담아 둔다.
    const timer: { id?: NodeJS.Timeout } = {}
    const done = (p: Omit<ClaudeCliProbe, 'latencyMs'>) => {
      if (settled) return
      settled = true
      if (timer.id) clearTimeout(timer.id)
      resolve({ ...p, latencyMs: Date.now() - startedAt })
    }
    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(readCliPath(), ['--version'], { cwd: tmpdir(), env: cleanEnv(false), stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      done({ ok: false, version: null, errorCode: 'SPAWN_FAILED' })
      return
    }
    timer.id = setTimeout(() => {
      proc.kill('SIGKILL')
      done({ ok: false, version: null, errorCode: 'ETIMEDOUT' })
    }, timeoutMs)
    proc.stdout?.on('data', (b: Buffer) => {
      if (out.length < 4096) out += b.toString('utf8')
    })
    proc.on('error', (e: NodeJS.ErrnoException) => done({ ok: false, version: null, errorCode: e.code === 'ENOENT' ? 'NOT_FOUND' : 'SPAWN_FAILED' }))
    proc.on('close', (code) => {
      if (code !== 0) return done({ ok: false, version: null, errorCode: `EXIT_${code ?? 'SIGNAL'}` })
      const first = out.split('\n')[0]?.trim() ?? ''
      done({ ok: true, version: VERSION_TOKEN.test(first) ? first : null, errorCode: null })
    })
  })
}
