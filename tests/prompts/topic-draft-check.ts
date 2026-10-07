/**
 * task-045 PE — `topicDraft@v2` 오프라인 점검. **결정적·LLM 0·DB 0**(일회용 점검 스크립트).
 *
 * 실행(미러에서, DB 접촉 없음):
 *   DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx tests/prompts/topic-draft-check.ts
 * 끝 코드 0 = 모든 FAIL 항목 통과.
 *
 * 점검 묶음
 *   A 요청       시드 주제 5개를 입력으로 본문 검사·요청 빌드 통과 · 스키마 JSON 이 프롬프트에 실린 전체 길이 ≤ 4,300자 · 엔진명·TTS 파라미터 0
 *   B 시드 정답   시드 주제 5개의 기본 표현을 응답 모양으로 만들어 항목 검사 통과 — 12개 전부 남음·버림 0·표기 중복 0·뜻 중복 0·유형당 3·스키마(ajv) 통과·수업 조각 상한(20) 안
 *   C 변이       점검기가 실제로 잡는지 — 읽기 바꾸기·표기 중복·뜻 중복·한자 괄호 병기·유형 5번째·어려운 급수를 한 개씩 넣어 각각 정확히 그 이유로 버려지는지(빈 증명 방지)
 *   D 라이브 입력 픽스처 `liveCases` 25건이 본문 검사를 통과하고(의미 판단은 LLM 몫 — 주입 문장도 본문 검사는 통과해야 [입력] 가둠이 방어한다) 요청이 만들어짐 · 비밀 유사 문자열 3종은 LLM 앞에서 400
 *   E 실응답 샘플 픽스처 `offline.samples` 10건(v1 5 + v2 5: N2·N1·인사 거절·영문 주입)의 상태·남은 표현 수가 기대와 같음
 *   F 서버 이중 방어(REV-147 I-1) 제목·일본어 제목·설명의 URL·꺾쇠·비밀 모양·숨은 문자는 INVALID(TEXT_UNSAFE), 표현 칸은 그 표현만 이유 코드로 버림 — 정상 한국어·일본어·엔진명은 통과
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../src/modules/engine/llm'
import { llm } from '../../src/modules/engine'
import { validateOutput, withJsonOnly } from '../../src/modules/engine/json/schemaValidate'
import { buildTopicDraftRequest, finalizeTopicDraft } from '../../src/modules/conversation/prompts/topicDraft'
import { detectUnsafeTopicText, fitTopicDraft, parseTopicDraftBody, TOPIC_DRAFT_SCHEMA, type TopicDraftChunkModel, type TopicDraftResponse } from '../../src/modules/conversation/structuredResponse/topicDraftSchemas'
import { normalizeTopicWordKey } from '../../src/modules/conversation/prompts/topicWords'
import type { ChunkType, JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

const ROOT = process.cwd()
interface SeedTopic { key: string; title: string; titleJa: string; level: JlptLevel; description: string; chunks: Array<{ chunkType: ChunkType; textJa: string; reading: string; meaningKo: string }> }
const seeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/topics.json'), 'utf8')) as SeedTopic[]
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/topic-draft.json'), 'utf8')) as {
  liveCases: Array<{ id: string; title: string; level: JlptLevel; note?: string; routeBlocked?: string }>
  offline: { samples: Array<{ id: string; level: JlptLevel; title: string; response: TopicDraftResponse }> }
}

const fails: string[] = []
const infos: string[] = []
const fail = (k: string, m: string) => fails.push(`[${k}] ${m}`)
const mk = (c: SeedTopic['chunks'][number], jlpt: TopicDraftChunkModel['jlpt'] = null): TopicDraftChunkModel => ({ ...c, jlpt })
const respOf = (t: SeedTopic, chunks: TopicDraftChunkModel[]): TopicDraftResponse => ({ status: 'OK', draft: { title: t.title, titleJa: t.titleJa, description: t.description, chunks } })

// A 요청
for (const t of seeds) {
  const body = parseTopicDraftBody({ title: t.title, level: t.level })
  if (!body.ok) { fail('A', `${t.key}: 본문 검사 실패 ${JSON.stringify(body.problems)}`); continue }
  const req = buildTopicDraftRequest(body.value)
  const full = renderTranscript(withJsonOnly(req.system, req.jsonSchema), req.messages) + (req.persona?.prompt ?? '')
  if (full.length > 4_300) fail('A', `${t.key}: 전체 프롬프트 ${full.length}자 > 4,300`)
  if (llm.mentionsEngineIdentity(full) || /speaker|pitch|model_id|styleWeight|connectionId/i.test(full)) fail('A', `${t.key}: 엔진명·TTS 파라미터가 프롬프트에 있다`)
  infos.push(`A ${t.key} ${t.level} 프롬프트 ${full.length}자`)
}

// B 시드 정답
const seenAcross = new Map<string, string[]>()
for (const t of seeds) {
  const resp = respOf(t, t.chunks.map((c) => mk(c)))
  if (!validateOutput(resp, TOPIC_DRAFT_SCHEMA).ok) fail('B', `${t.key}: 스키마 위반`)
  const fin = fitTopicDraft({ level: t.level, title: t.title }, resp)
  if (fin.status !== 'OK') { fail('B', `${t.key}: status ${fin.status} ${fin.problems.join(',')}`); continue }
  if (fin.repairs.dropped.length) fail('B', `${t.key}: 시드 표현이 버려졌다 ${JSON.stringify(fin.repairs.dropped)}`)
  if (fin.repairs.kept !== 12 || fin.repairs.kept > 20) fail('B', `${t.key}: 남은 표현 ${fin.repairs.kept} ≠ 12`)
  const keys = new Set((fin.draft?.chunks ?? []).map((c) => normalizeTopicWordKey(c.textJa)))
  if (keys.size !== 12) fail('B', `${t.key}: 표기 중복 있음`)
  const meanings = new Set((fin.draft?.chunks ?? []).map((c) => c.meaningKo))
  if (meanings.size !== 12) fail('B', `${t.key}: 뜻 중복 있음`)
  for (const [ty, n] of Object.entries(fin.repairs.typeCounts)) if (n !== 3) fail('B', `${t.key}: ${ty} ${n}개 ≠ 3`)
  for (const c of t.chunks) seenAcross.set(c.textJa, [...(seenAcross.get(c.textJa) ?? []), t.key])
}
for (const [k, v] of seenAcross) if (v.length > 1) infos.push(`B 주제 간 같은 표기 ${k}: ${v.join(', ')} (정보 — 주제마다 따로 저장되므로 FAIL 아님)`)

// C 변이
const t0 = seeds[0]
const base = (): TopicDraftChunkModel[] => t0.chunks.map((c) => mk(c))
const nm = (textJa: string, reading: string, meaningKo: string, chunkType: ChunkType = 'NAME', jlpt: TopicDraftChunkModel['jlpt'] = null): TopicDraftChunkModel => ({ textJa, reading, meaningKo, chunkType, jlpt })
const mutants: Array<{ reason: string; label: string; extra: TopicDraftChunkModel[]; drops: number; kept: number }> = [
  { reason: 'READING_MISMATCH', label: '가나 구간이 다른 읽기', extra: [nm('働いています', 'はたらいております', '일하고 있어요', 'ACTION')], drops: 1, kept: 12 },
  { reason: 'DUP_SURFACE', label: '표기 중복', extra: [{ ...mk(t0.chunks[0]), meaningKo: '성함이에요' }], drops: 1, kept: 12 },
  { reason: 'DUP_MEANING', label: '뜻 중복', extra: [nm('氏名', 'しめい', t0.chunks[0].meaningKo, 'FEELING')], drops: 1, kept: 12 },
  { reason: 'SURFACE_CHARS', label: '한자 괄호 병기', extra: [nm('趣味(しゅみ)', 'しゅみ', '취미')], drops: 1, kept: 12 },
  { reason: 'TYPE_OVER', label: '유형 5번째(NAME 4→5)', extra: [nm('住所', 'じゅうしょ', '주소'), nm('年齢', 'ねんれい', '나이')], drops: 1, kept: 13 },
  { reason: 'JLPT_TOO_HARD', label: '어려운 급수', extra: [nm('恐縮です', 'きょうしゅくです', '송구해요', 'FEELING', 'N2')], drops: 1, kept: 12 },
]
for (const m of mutants) {
  const fin = fitTopicDraft({ level: t0.level, title: t0.title }, respOf(t0, [...base(), ...m.extra]))
  const got = fin.repairs.droppedByReason[m.reason as keyof typeof fin.repairs.droppedByReason] ?? 0
  if (fin.status !== 'OK' || got !== m.drops || fin.repairs.kept !== m.kept) fail('C', `변이 "${m.label}" 가 ${m.reason} ${m.drops}건으로 버려지지 않았다: ${JSON.stringify(fin.repairs.droppedByReason)} kept=${fin.repairs.kept}`)
}

// D 라이브 입력·비밀 문자열
for (const c of fixture.liveCases) {
  const body = parseTopicDraftBody({ title: c.title, level: c.level, ...(c.note ? { note: c.note } : {}) })
  if (c.routeBlocked) {
    // 40자 초과 입력은 라우트가 400 으로 먼저 막는다 — 막히지 않으면 픽스처 설명이 거짓이다.
    if (body.ok || !body.problems.every((p) => p.reason === 'max_length')) fail('D', `${c.id}: routeBlocked 인데 max_length 로 막히지 않았다`)
    infos.push(`D ${c.id}: 본문 검사 max_length 로 LLM 앞에서 차단(라이브는 앞 40자만 전송)`)
    continue
  }
  if (!body.ok) { fail('D', `${c.id}: 본문 검사가 막았다 ${JSON.stringify(body.problems)} — 의미 판단은 LLM 몫이라 통과해야 한다`); continue }
  try { buildTopicDraftRequest(body.value) } catch (e) { fail('D', `${c.id}: 요청 빌드 실패 ${(e as Error).message}`) }
}
for (const secret of ['sk-abcdefghijklmnopqrstu 키', 'Bearer abcdefghijklmnop1234567890', 'password=hunter2hunter2 비밀']) {
  if (parseTopicDraftBody({ title: secret, level: 'N5' }).ok) fail('D', `비밀 유사 문자열이 LLM 앞에서 막히지 않았다: ${secret}`)
}

// E 실응답 샘플
const expectE: Record<string, { status: string; kept?: number }> = {
  'new-airport': { status: 'OK', kept: 16 },
  'new-hobby': { status: 'OK' },
  'rej-inject-mixed': { status: 'OK', kept: 15 },
  'rej-question': { status: 'NOT_A_TOPIC' },
  'rej-unsafe-weapon': { status: 'UNSAFE' },
  // topicDraft@v2 실응답(REV-147 재측정)
  'new-n2-legal-v2': { status: 'OK', kept: 16 },
  'new-n1-policy-v2': { status: 'OK', kept: 16 },
  'new-greeting-scene-v2': { status: 'OK', kept: 15 },
  'rej-greeting-v2': { status: 'NOT_A_TOPIC' },
  'rej-inject-en-v2': { status: 'UNSAFE' },
}
for (const s of fixture.offline.samples) {
  const fin = finalizeTopicDraft({ level: s.level, title: s.title }, s.response)
  const e = expectE[s.id]
  if (!e) { fail('E', `${s.id}: 기대값 없음`); continue }
  if (fin.status !== e.status) fail('E', `${s.id}: status ${fin.status} ≠ ${e.status}`)
  if (e.kept !== undefined && fin.repairs.kept !== e.kept) fail('E', `${s.id}: kept ${fin.repairs.kept} ≠ ${e.kept}`)
}

// F 서버 이중 방어(I-1)
const f0 = seeds[0]
const unsafeTexts: Array<[string, string]> = [['URL', 'https://evil.example/x 방문'], ['URL', 'www.evil.example'], ['MARKUP', '<script>alert(1)</script>'], ['SECRET_LIKE', 'sk-abcdefghijklmnopqrstuvwxyz'], ['CONTROL_CHARS', `병${String.fromCodePoint(0x200b)}원`]]
for (const [kind, text] of unsafeTexts) {
  if (detectUnsafeTopicText(text) !== kind) fail('F', `detectUnsafeTopicText(${JSON.stringify(text)}) ≠ ${kind}`)
  for (const field of ['title', 'titleJa', 'description'] as const) {
    const resp = respOf(f0, f0.chunks.map((c) => mk(c)))
    if (resp.draft) resp.draft[field] = text
    const fin = fitTopicDraft({ level: f0.level, title: f0.title }, resp)
    if (fin.status !== 'INVALID' || !fin.problems.includes('TEXT_UNSAFE')) fail('F', `${field} ${kind}: INVALID(TEXT_UNSAFE) 가 아니다 ${fin.status} ${fin.problems.join(',')}`)
  }
  for (const [where, bad] of [['textJa', nm(text, 'びょういん', '병원')], ['reading', nm('病院', text, '병원')], ['meaningKo', nm('病院', 'びょういん', `병원 ${text}`)]] as const) {
    const fin = fitTopicDraft({ level: f0.level, title: f0.title }, respOf(f0, [...base(), bad]))
    if (fin.status !== 'OK' || fin.repairs.droppedByReason[kind as 'URL'] !== 1 || fin.repairs.kept !== 12) fail('F', `표현 ${where} ${kind}: 그 이유로 한 개만 버려지지 않았다 ${JSON.stringify(fin.repairs.droppedByReason)} kept=${fin.repairs.kept}`)
  }
}
for (const ok of ['병원에서 진료받기', '病院で診察', 'Claude 사용법', 'www 사이트', '12:30 예약']) {
  if (detectUnsafeTopicText(ok) !== null) fail('F', `정상 글이 막혔다: ${ok}`)
}
{
  const fin = fitTopicDraft({ level: f0.level, title: f0.title }, respOf(f0, f0.chunks.map((c) => mk(c))))
  if (fin.status !== 'OK') fail('F', '대조(시드 정상 초안)가 OK 가 아니다')
}

for (const i of infos) console.log(`  · ${i}`)
if (fails.length) {
  console.error(`\nFAIL ${fails.length}건`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`\nOK — A 요청 ${seeds.length} · B 시드 ${seeds.length} · C 변이 ${mutants.length} · D 라이브 입력 ${fixture.liveCases.length}+비밀 3 · E 실응답 ${fixture.offline.samples.length} · F 이중 방어 ${unsafeTexts.length}종×(제목 3칸+표현 3칸)`)
