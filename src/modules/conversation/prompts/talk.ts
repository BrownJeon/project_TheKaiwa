/**
 * A1 회화 턴(TALK) 프롬프트 — design-spec §8 A1, tutor.md §3·§6.
 * 예산: 페르소나(절 1·3·4(수준 행)·6(TALK 행))는 `--agents` 시스템 프롬프트, 사용자 프롬프트(오늘·모드·학습자 헤더 ≤300·교정
 * 모드·창·발화)는 ≤3,000자.
 *
 * task-007 K4(음성 회화 TTFA): 스키마(`structuredResponse/schemas.ts`)·후검증(`checks.ts`)의 필드·제약은 그대로 두고
 * **출력 순서만 지시문으로 민다**(이 두 파일은 이 task 의 소유 경계 밖).
 *  1. JSON 최상위 키 순서 speech → conversation → correction → learning → endOfTopic → proposals, conversation 안은
 *     replyJa → replyKo(talk@v8 부터 — v7 까지는 replyJa 와 replyKo 사이에 읽기 줄 필드가 있었다). developer 가 `--include-partial-messages` 스트림에서 `speech.style`(TTS 톤) →
 *     `replyJa`(문장 단위 조기 합성) 순으로 증분 추출하므로 이 둘이 최대한 먼저 나와야 한다.
 *  2. replyJa 첫 문장은 「そうですね。」처럼 아주 짧은 맞장구 — 문장 경계(。！？)가 빨리 나올수록 TTS 첫 청크(TTFA)가 빨라진다.
 *  ⚠ 순서 준수는 모델의 자연어 지시 해석에 달려 있을 뿐이다 — JSON Schema 는 키 순서를 표현하지 못하고, `engine/json/schemaValidate.withJsonOnly`
 *  가 이 프롬프트 뒤에 덧붙이는 원본 스키마 텍스트는 `schemas.ts` 선언 순서(conversation·correction·learning·speech·…) 그대로라
 *  상충 신호가 될 수 있다 — 실측 결과와 상충 메모는 [[llm-japanese-quality]] §6. 강제(재시도)하지 않는다.
 *
 * task-010c(talk@v3, 교정 방식) — learning-personalization §2-7·§2-8, tutor.md §3-4. **교정 강도(strictness, 무엇을
 * 오류로 볼지)와 교정 방식(correctionMode, 얼마나 자주·어떻게 보여줄지)은 독립 축**이다(design-spec 정합, §2-8). 이
 * 파일이 다루는 것은 방식뿐 — 모드는 stdin 쪽(`system`)에 `[교정] 유창성|코치` 한 줄로만 얹는다. **persona(→
 * `--system-prompt`)는 여전히 (model, learner.level, mode) 로만 정해져 바이트 불변**(K4-3 그대로, correctionMode 는
 * persona 를 만들지 않는 인자다) — CLI 예열 프로세스 재사용에 영향 없다.
 *  - FLUENCY(기본): 대화 흐름 우선. 교정은 여전히 가장 중요한 1건만 correction 에 넣는다. `hintKo` 는 항상 null —
 *    즉시 교정문을 보여준다(orchestrator 가 severity 로 즉시 카드(MAJOR)/모아두기(MINOR)를 가른다, task-010c L2) —
 *    **그래서 severity 정확도가 이 모드의 핵심이다**. 1차 릴리스는 persona §3-6("의미가 안 통하면 MAJOR")만 믿고
 *    stdin 쪽에 안 넣었는데, 실측(조사·활용 오류 3/3 이 전부 MAJOR)에서 모아두기 게이팅이 사실상 무력화됐다 — 그래서
 *    Leader 후속 지시(2026-09-28)로 `FLUENCY_SEVERITY_RULE`(아래, "뜻 통하면 MINOR·안 통하면 MAJOR" + 분류 예시)을
 *    **유창성일 때만** `[교정]` 헤더 줄에 덧붙였다(코치는 매 턴 보여주므로 이 게이팅과 무관, 손대지 않음). 재측정
 *    결과는 [[llm-japanese-quality]] §9, task-010c 이력서.
 *  - COACH: `correction.hintKo` 에 정답을 그대로 말하지 않는 힌트를 채운다 — 학습자가 한 번 더 스스로 고쳐 말해
 *    보도록 유도한다(tutor.md §3-4). 못 고치면 다음 턴에 교정문이 그대로 나온다(카드 [정답 보기] 는 UI 몫). 지시문은
 *    " hintKo=힌트(정답 제외)."처럼 최소 글자만 쓴다(아래 예산 절 이유) — 2026-09-28 라이브 실측(haiku, e01~e03
 *    3턴씩) 은 이 짧은 문구만으로도 hintKo 3/3 채움·정답 누출 0/3·위반 0 이었다(`tests/live/talk-correction-mode-
 *    measure.ts`). 단 그 누출 판정은 일본어 정답 문자열 기준이라 한국어 뜻 노출은 못 잡았다 — QA 2차 결함 #3 으로 `COACH_HINT_LINE` 을 보강(아래).
 *  스키마 변경은 `correctionObject` 에 `hintKo`(nullable) 하나만 additive 로 추가했다 — 기존 필드·CHAT_SCHEMA(항상
 * `correction:null`이라 영향 없음)는 무변경. 후검증은 `checkTalkResponse` 에 "hintKo 가 corrected 를 그대로 포함하면
 * 위반" 한 줄만 추가했다(둘 다 `structuredResponse` 소유 파일 — 이 task 의 명시적 요구 사항, "한두 줄만 Edit").
 *
 * task-024(talk@v4, IMP-0010 응답 길이를 상황별로) — 사용자 관찰 "AI 응답이 너무 간단하다". 원인은 2문장 상한 자체보다 **첫 문장이
 * 통째로 「そうですね。」 같은 맞장구에 소모돼 실질 문장이 1개뿐**이던 구조였다(TTFA 를 위해 넣었던 규칙). v4 는 ① 문장 수 상한을
 * 하드코딩하지 않고 `sceneCap`(1~4) 인자로 치환하고, ② 첫 문장은 여전히 짧게 하되 맞장구뿐 아니라 **물음에 대한 짧은 직답**도
 * 허용하며(「1000円です。」 — 점원 응대), ③ 모델이 그 상한 **안에서** 상황(발화 길이·질문 여부·뜻의 애매함)으로 길이를 정하게 한다.
 * **별도 판단 호출은 두지 않는다**(5초 예산). `sceneCap` 은 호출 전 신호(발화 길이·물음표·altText 등)로 코드(orchestrator)가 고른다 —
 * 값 표와 신호는 task-024 이력서 "Prompt-Engineer 기록". 생략하면 2(v3 와 같은 상한). `persona`(`--system-prompt`)에는 상한을 넣지 않는다
 * (턴마다 바뀌는 값이라 넣으면 CLI 예열 프로세스 재사용이 깨진다 — 기존 K4-3 원칙 그대로, 상한은 stdin `[지시]` 줄에만).
 *
 * task-010c REV-055 M-1(talk@v5, 헤더 모순 제거) — v3·v4 는 학습자 헤더에 `교정 모드 COACH`(기본값 고정 — 헤더 재료가 교정 방식을 안 싣는다)와
 * `[교정] 유창성|코치` 줄이 **동시에** 들어갔다. 기본(유창성) 턴 전부가 서로 모순된 두 줄을 받은 셈이고, 실측 28/28 통과는 `[교정]` 줄이 이긴다는
 * 것만 보였다(모델 교체·문구 변화에 안전하다는 보장이 아님). v5 는 TALK 헤더에서 그 칸을 뺀다(`renderHeader` 의 `omitCorrectionMode`) —
 * `[교정]` 줄이 단일 출처, 헤더 14자 절감(예산 마진 +14). persona §3-4 의 "(모드는 헤더)" 는 "(모드는 `[교정]` 줄)" 로 맞췄다(persona 바이트는
 * (model, level, mode) 로만 정해지는 불변 조건 그대로 — 턴마다 바뀌지 않는다).
 * 같은 v5(미배포) 안에서 제자리 보강 1건 더(버전 번호 유지, Leader 결정) — task-010c QA 2차 결함 #3: COACH 힌트가 정답을 한국어 뜻으로 노출
 * (`내일이 아니라 어제였나요?`, 정답 `昨日`). 서버 누출 필터는 일본어 문자열만 보고 한국어 뜻 필터는 만들지 않으므로 `COACH_HINT_LINE` 이 정답의
 * 일본어 표기뿐 아니라 한국어 뜻·번역·「X가 아니라 Y」의 Y 도 금하고 힌트를 방향(품사·시제·상황 단서·글자 수)으로 한정한다. COACH 한정(FLUENCY 바이트 불변).
 *
 * **예산(2026-09-28 실측·재발 방지 기록, 2차 갱신)**: `[교정] 유창성|코치` 헤더 한 줄만 더해도(instruction 문구는
 * 최소로 줄인 뒤에도) 특정 조합에서 캡을 넘겼다 — 원인은 새 문구 길이가 아니라 `WINDOW_ROOM_SLACK`(옛 이름 없이
 * `- 40` 매직 넘버였다) 이 이력 창의 렌더링 오버헤드(메시지당 라벨 접두)를 과소 추정해 **v2 부터 이미** 특정 조합
 * (무거운 학습자 헤더 + altText **중간 길이** ≈60자, longHistory)의 실마진이 3자뿐이었기 때문이다(극단으로 긴
 * altText 가 아니라 중간 길이가 최악이었다 — altText·이력 창이 서로 다른 양자화 단위로 예산을 나눠 갖는다).
 * `WINDOW_ROOM_SLACK` 정의 옆 주석에 근거를 남기고 1차 40→140 으로 올렸다. Leader 후속 지시로 `FLUENCY_SEVERITY_
 * RULE`(62자)을 더 얹으면서 마진이 24자까지 좁아져 **140→220** 으로 2차 상향했다 — 재측정(light/heavy 학습자 ×
 * FLUENCY/COACH × 발화 1~1,000자 × altText 60~50,000자) 최소 103자 마진 확인(`prompts.test.ts` 예산 회귀 테스트로
 * 고정, 현재 최악 조합은 heavy COACH text=1 alt=201).
 *
 * task-028(talk@v6, IMP-0020·IMP-0022) — 재현(2026-10-03, traceId `t_rApoXn51DLgsUlR4OfBD`): 일본어는 정상(「ビニール袋を
 * お付けします」)인데 번역(`conversation.replyKo`)이 「비닐봉투를 드려드리겠습니다」(겸양 「드리다」가 중첩된 이중 높임 비문)로 나왔다.
 * ① `replyJaInstructionLine` 의 tail 에 "replyKo 는 자연스러운 존댓말 번역(이중 높임 금지)" 을 더했다(기존 "한국어 번역." 대체,
 * +16자) — 모델이 직역·이중 높임으로 새는 것을 지시문만으로 완전히 막을 보장은 없어 `checks.ts` 의 `checkReplyKoNaturalness`
 * (명백한 "드려드리" 패턴만 좁게 잡는 후검증, **TALK 전용** — `checkTalkResponse` 에 넣지 않고 `buildTalkRequest` 의
 * `extraCheck` 에서만 합성해 CHAT(A2)에 영향 없음, 비범위이기 때문)로 받친다. ② `correction.explanationKo` 를 학습자의
 * 기존 `level`(새 설정 없음)에 맞춰 N5·N4 는 "쉬운 말로, 문법 용어는 쓰지 않습니다"를 덧붙이고(`SIMPLE_EXPLANATION_LEVELS`),
 * 레벨과 무관하게 "일본어 인용은 고친 조각만"을 공통으로 더했다(`correctionInstructionLine`, +약 30~46자 — 레벨에 따라 다름).
 * 두 변경 다 `[지시]` 줄(stdin)에만 있고 persona(`--system-prompt`)는 손대지 않았다 — persona 는 이미 (model, **level**, mode)
 * 로 정해지므로 레벨별 난이도 표 트리밍은 기존 `loadPersona` 가 한다(바이트 불변 범위는 "같은 학습자" 기준 그대로). 예산 실측은
 * task-028 이력서 "Prompt-Engineer 기록"(기존 최악 조합 마진 52자 → 변경 후 실측치 기록).
 *
 * task-026(talk@v7, 내 말 번역 `userKo`) — 사용자 결정 E5·E6-A(내 말 번역도 보낼 때마다 생성)를 **추가 LLM 호출 없이** 구현하려고(Developer 조사 T1:
 * Claude CLI 가 동시성 1 의 2레인 큐라 별도 번역 호출은 다음 회화 턴을 막아 5초 예산을 깬다) 응답 계약에 학습자 말의 한국어 번역 `userKo` 를
 * 더했다. ① 최상위 키, 출력 순서상 **맨 끝**(… → endOfTopic → proposals → userKo) — 첫 음성(speech.style → replyJa 조기 추출)과 문장 단위
 * 합성은 영향이 없고 `done` 만 출력 토큰만큼(실측 task-026 기록) 늦는다. ② 같은 A5·A11 교훈 — 지시문 필드 나열과 응답 골격(`[순서 예]`)에 **정확한
 * 이름 `userKo` 를 넣고** 스키마 properties·테스트로 맞췄다(required 는 아니다 — REV-086 M3, ⑤). ③ 번역 문체는 `replyKo` 줄과 같은 규칙(자연스러운 한국어·이중 높임 금지)에 "교정·보충 없이
 * 말한 그대로(말투·높임 수준 포함)"를 더했다(1차 실측에서 반말 「ごめん」이 「죄송합니다」로 올라가 추가) — 저장 전 정리는 전부 `sanitizeUserKo`(누락·빈 값·과길이·베끼기·한글 없음·이중 높임 → null, 재시도 없음)가 맡는다(저장·화면은 developer 몫).
 * ⑤ REV-086 M3: 번역은 부가 정보라 **스키마 선택(required 아님)·null 허용·길이 무제한**이고 extraCheck 에도 합성하지 않는다 — 이 필드 때문에 ajv 재시도나 턴 실패(`JsonSchemaError`)가 나지 않는다. ④ (v7 당시) 히라가나 읽기 줄 필드는 말풍선·`ChatMessage.reading` 이 쓰고 있어 유지했다 — 서버 분석(S1)·화면 A 가 배포된 뒤 task-036 에서 뺐다(아래).
 *
 * task-036(talk@v8, 구 읽기 줄 필드 제거) — 화면 A(한자 위 후리가나·아래 한글 줄)와 서버 분석(#24r, pyopenjtalk)이 운영 반영돼 `conversation` 안의 히라가나 읽기 한 줄을
 * LLM 이 매 턴 만들어도 새 메시지에서 읽는 화면이 없어졌다(`ChatMessage.reading` 은 쓰기 전용). 그 필드를 지시 줄·`[순서 예]` 골격·키 순서 문구·스키마(required·properties)·
 * `TutorResponse` 타입·테스트에서 한꺼번에 뺐다(정확한 이름을 4곳에 일치시킨다는 A5·A11 교훈 — 한 곳이라도 남으면 재시도·FAILED). 키 순서는 `speech → conversation(replyJa → replyKo) → …`
 * 로 **`replyJa` 앞은 그대로**다 — `speech.style` → `replyJa` 조기 추출(`jsonPathStream`)·문장 단위 합성은 불변. persona(`tutor.md`·`--system-prompt`)는 무변경(바이트 불변).
 * DB `ChatMessage.reading` 컬럼은 남기고 새 메시지는 null(서버 `saveTurn`), 옛 메시지 값은 그대로다. 기대 이득: 턴당 출력 −30~45 토큰(히라가나 한 줄) → `done` 단축.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkReplyKoNaturalness, checkTalkResponse } from '../structuredResponse/checks'
import { TALK_SCHEMA, USER_KO_PROMPT_MAX, type TutorResponse } from '../structuredResponse/schemas'
import { buildWindow, type WindowMessage } from '../window'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const TALK_PROMPT_VERSION = 'talk@v8'
export const TALK_USER_PROMPT_CAP = 3_000
export const TALK_HEADER_CAP = 300
/**
 * task-024 — replyJa 문장 수 상한(장면 상한)의 허용 범위와 기본값. 기본 2 는 v3 까지의 고정 상한이라 `sceneCap` 을 안 주면 같은 상한이다.
 * 범위 밖·비정수 값은 `clampSceneCap` 이 조용히 정리한다(프롬프트에 이상한 숫자가 새지 않게 — 결정은 호출부 몫, 여기는 방어만).
 */
export const TALK_SCENE_CAP_MIN = 1
export const TALK_SCENE_CAP_MAX = 4
export const TALK_SCENE_CAP_DEFAULT = 2
/**
 * 후검증(`checkTalkResponse`)이 재시도를 거는 문장 수 = 상한 + 이 값. v3 정책(목표 2·재시도는 3 초과에서만, `checks.ts`
 * `REPLY_SENTENCE_HARD_CAP` 주석 — 재시도 1회 ≈ +10s 로 12s fail-fast 위협)을 그대로 일반화한 것: 상한을 1 넘는 응답은 TTS·화면에
 * 무리가 없어 계약 위반으로 보지 않는다. 실측(task-024)으로 조정한다.
 */
export const TALK_SCENE_CAP_TOLERANCE = 1

export function clampSceneCap(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return TALK_SCENE_CAP_DEFAULT
  return Math.min(TALK_SCENE_CAP_MAX, Math.max(TALK_SCENE_CAP_MIN, Math.floor(n)))
}
/**
 * altText(STT 두 번째 후보) 상한 — 발화 한 턴 분량. 넘으면 앞 199자 + "…". 2026-09-28 실측: 상한이 없던 때 altText 5,000자면
 * 사용자 프롬프트가 7,459자(캡 3,000 초과 — 이력 창을 0으로 줄여도 못 막음). 200자면 최악 조합(발화 1,000자·헤더 300·긴 이력)도 2,920자.
 * 자르는 곳이 여기인 이유: 프롬프트 예산은 conversation 이 소유한다(speech 는 후보 텍스트만 넘기고 캡을 모른다 — 6층 경계).
 */
export const TALK_ALT_TEXT_MAX = 200
/** 이보다 짧게 잘라야만 들어간다면 후보 줄을 빼고 평소처럼 교정한다 — 잘린 후보로 되묻는 것은 학습자에게 혼란만 준다. */
const TALK_ALT_TEXT_MIN = 8
/** `renderTranscript` 가 system·발화 밖에 붙이는 고정 문자(`[입력]` 머리말·블록 구분자) 여유. */
const TRANSCRIPT_OVERHEAD = 120
/**
 * `room`(이력 창 문자 예산) 계산의 안전 여유 — **2026-09-28 task-010c 실측으로 40 → 140 → 220 으로 두 차례 올렸다**.
 * `room` 은 `buildWindow` 가 각 메시지의 순수 `content.length` 합만 보고 채우는 예산이라, `renderTranscript` 가
 * 나중에 각 줄 앞에 붙이는 `[학습자] `/`[선생님] ` 접두(메시지당 ~7~9자)와 `[대화] (앞선 맥락)`/`[입력] ` 블록
 * 머리말은 여기 반영되지 않는다 — 옛 상수(40)는 그 전부를 40자로 잡아 둔 과소 추정이었다. 이력 창은 메시지 단위
 * (약 240자, 픽스처 기준)로만 줄어드는 "양자화"라 평소엔 여유가 남아 문제가 없었지만, `[교정] 유창성|코치` 헤더
 * 한 줄(task-010c 1차)을 더하자 특정 조합(무거운 학습자 헤더 + altText ≈60자, `prompts.test.ts` 회귀)에서 실제
 * v2 마진이 이미 3자뿐이었던 것이 드러났다 — 극단으로 긴 altText 가 아니라 **중간 길이**가 최악이었다(altText·이력
 * 창이 서로 다른 단위로 예산을 나눠 갖기 때문). 1차 40→140 상향 뒤 Leader 후속 지시로 `FLUENCY_SEVERITY_RULE`
 * (아래, severity 정확도 보강)을 더 얹으면서 마진이 다시 24자까지 좁아져 **140→220** 으로 한 번 더 올렸다(전 조합
 * 최소 103자 마진 확보, 2026-09-28). 실제 대화에서는 헤더·발화가 훨씬 짧아 `room` 이 대개 상한(2,000)에 가까워
 * 이 여유 증가는 체감상 무해하다(위 sanity: 짧은 대화 6개면 slack 값과 무관하게 6개 모두 온전히 실린다).
 */
const WINDOW_ROOM_SLACK = 220

const altTextLine = (alt: string) => `[인식 후보] 학습자 말이 「${alt}」로도 들렸습니다. 둘 중 어느 쪽인지 먼저 되묻고 교정하지 마세요.`

/** task-010c — TALK 교정 방식. `strictness`(무엇을 오류로 볼지)와 독립(design-spec §2-8). 기본 FLUENCY. */
export const CORRECTION_MODES = ['FLUENCY', 'COACH'] as const
export type CorrectionMode = (typeof CORRECTION_MODES)[number]
const CORRECTION_MODE_LABEL_KO: Record<CorrectionMode, string> = { FLUENCY: '유창성', COACH: '코치' }
/**
 * Leader 후속 지시(2026-09-28, task-010c) — 유창성 모드는 orchestrator 가 `severity`로 즉시 표시(MAJOR)/모아두기
 * (MINOR)를 가르므로(L2) severity 정확도가 기능의 핵심이다. 실측(첫 릴리스, hintKo 안내만 있고 severity 판정 기준은
 * persona §3-6 뿐)에서 조사·활용 오류(뜻은 통함) 3/3 이 전부 MAJOR 로 나와 유창성 모드를 사실상 무력화했다 — 그래서
 * **유창성일 때만** `[교정]` 헤더 줄에 짧은 판정 기준을 더한다(코치는 매 턴 교정을 보여주므로 이 게이팅과 무관, 손대지
 * 않는다). 확보한 예산 여유(~84자, `WINDOW_ROOM_SLACK` 참고) 안에서 최대한 구체적으로 썼다 — 재측정 결과는
 * `llm-japanese-quality.md`, task-010c 이력서.
 */
const FLUENCY_SEVERITY_RULE = ' — severity: 조사·활용·어순·존댓말 오류는 뜻이 통하니 **항상 MINOR**. 완전히 다른 단어를 써서 말이 안 되거나 뜻이 반대로 바뀔 때만 MAJOR.'

/**
 * altText 정리: 제어문자·연속 공백 정리 → `min(TALK_ALT_TEXT_MAX, budget)` 로 자르기(서러게이트 쌍을 가르지 않게 코드포인트 단위,
 * 잘렸으면 끝에 "…") → 그 한도가 `TALK_ALT_TEXT_MIN` 미만이면 null(후보 줄 생략). `budget` 은 사용자 프롬프트 캡에서 남은 글자 수.
 */
export function clampAltText(raw: string | null | undefined, budget: number = TALK_ALT_TEXT_MAX): string | null {
  if (!raw) return null
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  const max = Math.min(TALK_ALT_TEXT_MAX, Math.floor(budget))
  if (max < TALK_ALT_TEXT_MIN) return null
  if (clean.length <= max) return clean
  let out = ''
  for (const ch of clean) {
    if (out.length + ch.length > max - 1) break
    out += ch
  }
  return `${out}…`
}

export interface TalkInput {
  todayKst: string
  learner: LearnerHeader
  /** 이번 발화 이전의 대화(오래된 것 → 최근). */
  history: WindowMessage[]
  /** 이번 학습자 발화(STT 최종 텍스트 또는 입력). */
  text: string
  /** 인식이 불확실할 때의 두 번째 후보(requiresReview) — 있으면 교정 대신 되묻는다(tutor §3-7). */
  altText?: string | null
  /** task-010c — 교정 방식(설정 `Profile.correctionMode`). 생략하면 FLUENCY(기본, D6 사용자 결정). */
  correctionMode?: CorrectionMode
  /**
   * task-024 — 이번 턴의 replyJa 문장 수 상한(1~4, 기본 2). 호출 전 신호(발화 길이·물음표·altText 등)로 코드가 정하는 **상한**이다 —
   * 실제 길이는 모델이 그 안에서 상황에 맞게 정한다(상한을 채울 필요 없음). persona 가 아니라 `[지시]` 줄에만 들어간다(바이트 불변 유지).
   */
  sceneCap?: number
}

/**
 * task-010c — 모드별 correction 지시문. 공통 규칙(원문 전체 복사·1건만)은 v2 와 **바이트까지 그대로** 두고,
 * `hintKo` 안내만 모드별로 최소 글자로 얹는다. **A1 은 ≤3,000자 예산이 가장 빡빡한 지점**이다 — 2026-09-28 실측
 * (`prompts.test.ts` 예산 회귀)에서 진짜 최악 조합은 altText 가 가장 긴 값(50,000자 등)이 아니라 **중간 길이
 * (≈60자, 기존 K4 가 "발화 한 마디" 가정으로 쓰던 값)** 일 때였다 — altText·이력 창이 서로 다른 "양자화 단위"
 * (240자짜리 이력 메시지)로 자리를 나눠 갖기 때문에, 중간 길이 조합에서 마진이 오히려 더 좁아질 수 있다(극단값이
 * 항상 최악은 아니다). 이 때문에 severity 리마인더를 한 번 얹었다가(29자) 이 중간 케이스에서 캡을 넘겨 되돌렸다
 * — `hintKo` 안내만 남긴다(당시 FLUENCY 15자·COACH 28자; COACH 는 결함 #3 으로 `COACH_HINT_LINE` 이 더 길어졌다 — 마진은 위 `WINDOW_ROOM_SLACK`·`a1sweep` 실측 참고). severity 기준("의미가 달라지면 MAJOR")은 persona §3-6 에도
 * 있으니 완전히 사라지는 것은 아니다(다만 stdin 쪽 리마인더 없이는 실측에서 과잉 MAJOR 판정이 있었다 — 아래 실측
 * 기록·developer 인계 참고, 예산이 이 task 의 최우선 순위라 절충했다). `checks.ts` 의 `checkTalkResponse`(hintKo 가
 * corrected 를 그대로 포함하면 위반)가 문구가 짧아도 hintKo 계약은 지킨다.
 */
/**
 * COACH `hintKo` 지시 — talk@v5 제자리 보강(task-010c QA 2차 결함 #3). 기존 "정답 제외" 한 마디는 **일본어 정답 문자열**만 막아, 힌트가
 * "내일이 아니라 어제였나요?"(정답 `昨日` 을 한국어 뜻 "어제"와 「X가 아니라 Y」 대비로 노출)처럼 정답을 뜻으로 드러냈다(표본 3건 중 1건).
 * 서버 누출 필터는 일본어만 비교하고 한국어 뜻 매칭은 오탐·정확도 한계로 만들지 않기로 했으므로(Leader 결정) **이 지시문이 유일한 방어**다.
 * 앞머리 `hintKo=힌트(정답 제외)` 는 그대로 두고(기존 회귀·QA 스윕이 그 문구를 본다) 뒤에 금지 대상을 구체적으로 이름 붙인다 — 일본어 표기·
 * 한국어 뜻·번역·「X가 아니라 Y」 의 Y. 대신 줄 수 있는 것(품사·시제·상황 단서·글자 수 = 방향)도 함께 적어 빈 힌트로 도망가지 않게 한다.
 * 실 LLM(haiku) 표본으로 두 번 조정했다(`task-010c-correction-mode.md` "Prompt-Engineer 기록"): 1차 문구(한국어 뜻·번역·「X가 아니라 Y」 금지)는 6건 중 「'귀로 들다'가 아니라
 * '눈으로 ___다'」(빈칸으로 정답 뜻 암시)를 냈고, 금지 대상만 늘린 2차 문구는 6건 중 5건이 「ㅁ으로 시작」(초성)·「듣다와 보다의 차이」·「'물'이라는 뜻의 단어」·
 * 「います와 あります의 차이」처럼 금지 목록을 우회하거나 새 단어를 꺼냈다 — 금지 목록은 길수록 모델이 그 형태를 따라 쓴다. 그래서 3차(현행)는 **허용 범위를 앞에 두고**
 * ("학습자가 쓴 말의 어느 부분을 어떤 방향에서 다시 볼지만" + 예시 한 줄) 금지 대상은 뒤로 돌렸다.
 * **COACH 에만** 붙는다(FLUENCY 는 hintKo=null 이라 바이트 불변).
 */
export const COACH_HINT_LINE =
  ' hintKo=힌트(정답 제외) — 한 문장, 학습자가 쓴 말의 어느 부분을 품사·시제·상황 단서·글자 수 중 어떤 방향에서 다시 볼지만(예: "동사 시제를 다시 봐요."). 고칠 단어·구는 일본어·한국어 뜻·번역·뜻풀이·빈칸·초성으로도, 「X가 아니라 Y」·두 말 대조로도 꺼내지 않습니다.'

/**
 * task-028(IMP-0022) — `explanationKo` 수준별 쉬운 한국어. 사용자 원문: "교정에 대한 설명은 되도록 사용자의 수준을
 * 고려하여 최대한 한글로 표기해줘". 학습자 헤더에 이미 들어가는 기존 `level`(새 설정 없음, Leader 보완 §2)을 그대로
 * 쓴다 — N5·N4 는 문법 용어(조사·활용·접속조사 등) 대신 쉬운 말로, 그 밖은 기존 설명 그대로(용어 사용 허용).
 * "일본어 인용은 고친 조각만"은 레벨과 무관하게 공통(explanationKo 가 교정문 전체를 다시 일본어로 길게 인용하는
 * 것을 막는다 — 예산·가독성 둘 다 이유). 예산은 A1 이 가장 빡빡해(WINDOW_ROOM_SLACK 주석 참고) 문구를 최소로 줄였다
 * — 재측정 결과는 task-028 이력서.
 */
const SIMPLE_EXPLANATION_LEVELS = new Set(['N5', 'N4'])

function correctionInstructionLine(mode: CorrectionMode, level: string): string {
  const simple = SIMPLE_EXPLANATION_LEVELS.has(level) ? ' 쉬운 말로, 문법 용어는 쓰지 않습니다.' : ''
  const common =
    '- correction: [입력]의 학습자 말에 오류가 있으면 가장 중요한 1건만, 없으면 null. original 에는 [입력]의 학습자 말 **전체**를 한 글자도 바꾸지 말고 그대로 복사하고(일부만 잘라 쓰지 않음), corrected 에 고친 문장을 둡니다. explanationKo 는 한국어로 어느 조각이 왜 틀렸는지 1~2문장(일본어 인용은 고친 조각만).' +
    simple
  const hint = mode === 'COACH' ? COACH_HINT_LINE : ' hintKo 는 null.'
  return common + hint
}

/**
 * task-024 — replyJa 지시 줄. 상한(`cap`)은 인자로 치환한다. 상한별 3단(실측으로 정함, task-024 이력서 기록):
 * - cap 1: 짧은 반응·물음 1문장.
 * - cap 2(기본·v3 호환): **v3 구조 그대로**(첫 문장 짧은 맞장구 또는 직답 → 둘째는 대화를 잇는 질문 한 문장) + 응대 상황 이어 가기 한 절.
 *   실측: 여기에 "상황별로 늘려도 된다"는 문구를 섞으면 인사·맞장구에서 3문장·질문 2개로 넘쳤다(v4b s01·s02) — 2 는 v3 처럼 좁게 둔다.
 * - cap 3~4: 상황별 기준(짧은 말 / 물음·설명 필요 / 뜻이 애매) — 모델이 상한 **안에서** 길이를 정한다.
 * 공통: 첫 문장은 짧게(TTFA), 질문은 한 번에 하나, 교정 설명은 replyJa 에 넣지 않는다(v3 그대로).
 */
export function replyJaInstructionLine(cap: number = TALK_SCENE_CAP_DEFAULT): string {
  const n = clampSceneCap(cap)
  const tail =
    '교정 설명·「〜ではなく」 같은 고쳐 말하기는 replyJa 에 넣지 않습니다(그건 correction 에만). replyKo 는 자연스러운 존댓말 번역(이중 높임 금지).'
  const clerk =
    '가게·식당처럼 응대 상황이면 점원처럼 직답한 뒤 다음 물음(사이즈·봉투·포인트카드·결제 등)으로 이어 가고, 학습자가 대답만 했어도 「かしこまりました。」로 끝내지 말고 다음 물음을 잇습니다. 질문은 한 번에 하나. '
  const head = '- conversation.replyJa: 학습자 수준 안의 자연스러운 일본어 '
  if (n <= 1) return `${head}**1문장** — 짧은 반응이나 물음 하나. ${tail}`
  if (n === 2) {
    return (
      `${head}**최대 2문장**(。！？로 끝나는 단위로 셈) — ① 「そうですね。」「いいですね！」처럼 아주 짧은 맞장구 한 마디거나 물음에 대한 짧은 직답(「1000円です。」) ② 대화를 잇는 질문 한 문장. ` +
      clerk +
      tail
    )
  }
  return (
    `${head}**최대 ${n}문장**(。！？로 끝나는 단위로 세며 넘기지 말 것 — 상한을 채우려고 늘리지 말고 상황에 맞게). ` +
    '첫 문장은 「そうですね。」「いいですね！」처럼 아주 짧은 맞장구 한 마디거나 물음에 대한 짧은 직답(「1000円です。」). ' +
    '그다음은 상황대로 — 짧은 말·인사면 반응 뒤 대화를 잇는 질문 하나로 끝, 학습자가 물었거나 설명이 필요하면 답을 충분히 하고 이어질 질문 하나, 뜻이 애매하면 되묻기. ' +
    clerk +
    tail
  )
}

/**
 * task-026 — `userKo` 지시 줄(TALK·CHAT 공통 문구, chat.ts 가 import). 필드 이름을 정확히 쓰고 필수임을 밝힌다(A5·A11 교훈).
 * 번역 문체는 replyKo 줄(자연스러운 한국어·이중 높임 금지)과 같고, 교정·보충 없이 학습자가 말한 뜻 그대로 옮기게 한다 —
 * [입력]만 번역하고 [인식 후보]·[대화]는 번역하지 않는다.
 */
export const USER_KO_INSTRUCTION_LINE = `- userKo(필수): [입력] 학습자 말의 한국어 번역 — 교정하지 말고 말한 그대로(말투·높임 수준 포함), 자연스러운 한국어로(이중 높임 금지), ${USER_KO_PROMPT_MAX}자 이내.`

export function talkInstruction(correctionMode: CorrectionMode = 'FLUENCY', sceneCap: number = TALK_SCENE_CAP_DEFAULT, level: string = 'N5'): string {
  return [
    '[지시] [입력]의 학습자 말에 선생님으로서 답하세요([대화]는 앞선 맥락입니다). **JSON 키 순서를 반드시 지킵니다**: speech → conversation(replyJa→replyKo) → correction → learning → endOfTopic → proposals → userKo.',
    '- speech.style: 답의 분위기.',
    replyJaInstructionLine(sceneCap),
    correctionInstructionLine(correctionMode, level),
    '- learning.grammarPoint 는 이번 턴의 핵심 문법(없으면 null), difficulty 는 학습자 수준. 주제가 자연스럽게 끝났으면 endOfTopic=true. proposals 는 학습자가 모르는 새 단어를 단어장에 넣자고 제안할 때만(최대 2개, 보통 빈 배열).',
    USER_KO_INSTRUCTION_LINE,
    '[순서 예] {"speech":{"style":"<...>"},"conversation":{"replyJa":"<...>","replyKo":"<...>"},"correction":null,"learning":{"grammarPoint":null,"difficulty":"<...>"},"endOfTopic":false,"proposals":[],"userKo":"<...>"}',
    INJECTION_GUARD,
  ].join('\n')
}

export function buildTalkRequest(input: TalkInput): LlmJsonRequest<TutorResponse> {
  // task-007 K4-3(예열 CLI 프로세스 확인): `persona`(→ claudeCli `--system-prompt`)는 (model, level, mode) 로만 정해진다 —
  // 오늘 날짜·학습자 헤더(약점·연속 출석 등 턴마다 바뀔 수 있는 값 포함)·교정 방식·altText·이력 창·이번 발화는 전부
  // `system`/`messages`(stdin) 쪽으로만 간다. 같은 학습자·같은 수준이 이어지는 한 `--system-prompt` 는 턴마다 바이트
  // 그대로라 developer 의 K2-1 예열 프로세스가 재사용할 수 있다 — 이미 그런 구조였고 이번(task-010c)에 고친 내용은 없다
  // (확인만). `buildChatRequest` 도 동일.
  const correctionMode: CorrectionMode = input.correctionMode ?? 'FLUENCY'
  const persona = loadPersona({ sections: [1, 3, 4, 6], level: input.learner.level, mode: 'TALK' })
  const correctionLine = `[교정] ${CORRECTION_MODE_LABEL_KO[correctionMode]}${correctionMode === 'FLUENCY' ? FLUENCY_SEVERITY_RULE : ''}`
  // 교정 방식은 `[교정]` 줄이 **단일 출처**다 — 학습자 헤더의 `교정 모드` 칸은 뺀다(talk@v5, REV-055 M-1: 헤더는 이 값을 못 받아 늘 `COACH` 로
  // 찍혀 유창성 턴에서 `[교정] 유창성` 과 모순이었다). 다른 프롬프트의 헤더는 그대로다(`renderHeader` 옵션이 TALK 전용).
  const head = [
    renderToday(input.todayKst),
    '[모드] TALK',
    renderHeader(input.learner, TALK_HEADER_CAP, { omitCorrectionMode: true }),
    correctionLine,
  ]
  const sceneCap = clampSceneCap(input.sceneCap)
  const instruction = talkInstruction(correctionMode, sceneCap, input.learner.level)
  // altText 는 상한(200)과 남은 예산 둘 다로 자른다 — 지시문·헤더가 나중에 길어져도 캡(3,000)을 넘지 않게(발화 원문은 자르지 않는다).
  const baseChars = [...head, instruction].join('\n').length + input.text.length + TRANSCRIPT_OVERHEAD
  const altBudget = TALK_USER_PROMPT_CAP - baseChars - altTextLine('').length - 1
  const alt = clampAltText(input.altText, altBudget)
  if (alt) head.push(altTextLine(alt))
  const system = [...head, instruction].join('\n')
  // 사용자 프롬프트 상한에서 헤더·지시·발화를 뺀 나머지를 창에 준다(최대 2,000자·6개).
  const room = Math.max(0, Math.min(2_000, TALK_USER_PROMPT_CAP - system.length - input.text.length - WINDOW_ROOM_SLACK))
  const window = buildWindow(input.history, { maxCount: 6, maxChars: room })
  return {
    task: 'talk',
    persona,
    system,
    messages: [...window, { role: 'user', content: input.text }],
    jsonSchema: TALK_SCHEMA,
    // task-037 — 루트를 한 칸 일찍 닫는 구문 슬립(`…"proposals":[]},"userKo":…}`)을 `}` 하나만 지워 읽는다(재시도 ≈1.5s·호출 1회 절약). 요청 단위 옵트인 — 고친 객체도 스키마·extraCheck 를 그대로 통과해야 한다.
    repairRootClose: true,
    // task-028 — checkTalkResponse(원문 무수정·문장 수)에 checkReplyKoNaturalness(이중 높임 후검증, TALK 전용)를 더한다.
    extraCheck: (data) => [
      ...checkTalkResponse(input.text, data, { maxSentences: sceneCap + TALK_SCENE_CAP_TOLERANCE }),
      ...checkReplyKoNaturalness(data.conversation.replyKo),
    ],
  }
}
