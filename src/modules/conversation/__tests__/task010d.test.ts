/**
 * task-010d A1-서버 — conversation 쪽 단위 테스트(DB·LLM 없음): 라우트 가드 해제(A3b-1 — G1 시험 교체: 요청 형태 검증만 남음),
 * 역할극 대화 생성 서비스(가짜 의존 — Chat 칸·기본값·TALK 만·learning 판정 404 전파), 코치 강제 연결, 종료 재료 읽기(가짜 tx — 잠금 순서·남의 대화 404·
 * 역할극 아님 400·힌트·스스로 고침·교정 수).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type Tx } from '@/modules/infra'
import { parseCreateChat } from '../chats/validate'
import { createRolePlayChat, parseRolePlayIds, readRolePlayEndFacts, ROLE_PLAY_TURNS_READ_MAX, type RolePlayChatDeps, type RolePlayChatRowData, type RolePlayOpening } from '../chats/rolePlay'
import { resolveTalkCorrectionMode } from '../corrections/talkDelivery'
import type { ChatRow } from '../chats'

const U = 'cuser0000000000000000010d'
const OTHER = 'cuser000000000000000other'

function expectApi(code: string, extra?: (e: ApiError) => void) {
  return (e: unknown) => {
    assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
    assert.equal(e.code, code)
    extra?.(e)
    return true
  }
}

test('G1 가드 해제(A3b-1): #28 본문의 scenarioId·lessonId 는 더는 FEATURE_NOT_READY 가 아니고 역할극 칸으로 따로 읽힌다 · ASK 는 그대로 400', () => {
  const body = { kind: 'TALK', topicId: 't_1', scenarioId: 'scn_seed', lessonId: 'les_1' }
  assert.deepEqual(parseCreateChat(body), { kind: 'TALK', title: null, topicId: 't_1', level: null }, '일반 칸만 읽는다(역할극 칸은 parseRolePlayIds)')
  assert.deepEqual(parseRolePlayIds(body), { scenarioId: 'scn_seed', lessonId: 'les_1' })
  assert.deepEqual(parseCreateChat({ kind: 'TALK', lessonId: 'les_1' }), { kind: 'TALK', title: null, topicId: null, level: null })
  assert.deepEqual(parseCreateChat({ kind: 'TALK', topicId: 't_1', scenarioId: null, lessonId: null }), { kind: 'TALK', title: null, topicId: 't_1', level: null }, 'null 은 지금처럼 통과(기존 클라이언트 본문)')
  assert.deepEqual(parseRolePlayIds({ kind: 'TALK', scenarioId: null, lessonId: null }), { scenarioId: null, lessonId: null }, '둘 다 null 이면 라우트는 일반 createChat')
  assert.throws(() => parseCreateChat({ kind: 'ASK', scenarioId: 'scn_seed' }), expectApi('VALIDATION'), 'task-064: ASK 는 열렸고 상황 칸은 400 VALIDATION')
  assert.throws(() => parseCreateChat({ kind: 'TALK', level: 'N9', scenarioId: 'scn_seed' }), expectApi('VALIDATION', (e) => assert.equal(e.details?.field, 'level')))
})

test('parseRolePlayIds(A3 용): 1~40자 문자열만, 없음/null 은 null, 그 밖은 400', () => {
  assert.deepEqual(parseRolePlayIds({ scenarioId: 'scn_seed', lessonId: null }), { scenarioId: 'scn_seed', lessonId: null })
  assert.deepEqual(parseRolePlayIds({}), { scenarioId: null, lessonId: null })
  assert.throws(() => parseRolePlayIds({ scenarioId: '' }), expectApi('VALIDATION', (e) => assert.equal(e.details?.field, 'scenarioId')))
  assert.throws(() => parseRolePlayIds({ lessonId: 'x'.repeat(41) }), expectApi('VALIDATION', (e) => assert.equal(e.details?.field, 'lessonId')))
  assert.throws(() => parseRolePlayIds({ scenarioId: 7 }), expectApi('VALIDATION'))
})

function chatRow(d: RolePlayChatRowData, topicTitle: string | null): ChatRow {
  return {
    id: 'chat_rp_new',
    kind: d.kind,
    title: d.title,
    level: d.level,
    lastMessageAt: d.lastMessageAt,
    preview: null,
    messageCount: 0,
    reviewedAt: null,
    createdAt: d.createdAt,
    topic: d.topicId ? { id: d.topicId, title: topicTitle ?? '' } : null,
  }
}

function deps(over: Partial<RolePlayChatDeps> = {}) {
  const created: RolePlayChatRowData[] = []
  const openings: (RolePlayOpening | null)[] = []
  const resolved: unknown[] = []
  const d: RolePlayChatDeps = {
    resolveStart: async (userId, input) => {
      resolved.push({ userId, input })
      return { scenario: { id: 'scn_seed', title: '사이즈·온도 바꿔 주문하기', titleJa: 'サイズと温度を変えて注文する', level: 'N5' }, lessonId: input.lessonId, topic: { id: 't_cafe', title: '카페' }, topicSource: 'SCENARIO' }
    },
    readMaterial: async () => null,
    createChat: async (data, opening) => {
      created.push(data)
      openings.push(opening)
      return chatRow(data, '카페')
    },
    ...over,
  }
  return { d, created, openings, resolved }
}

test('역할극 대화 생성: Chat.scenarioId·lessonId·topicId 기록, 제목·수준 기본값 = 상황, 요청 값 우선, TALK 만', async () => {
  const { d, created, resolved } = deps()
  const dto = await createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId: 'scn_seed', lessonId: 'les_mine' }, d)
  assert.deepEqual(resolved, [{ userId: U, input: { scenarioId: 'scn_seed', lessonId: 'les_mine', topicId: null } }])
  assert.equal(created.length, 1)
  const row = created[0]
  assert.deepEqual([row.userId, row.kind, row.scenarioId, row.lessonId, row.topicId, row.title, row.level], [U, 'TALK', 'scn_seed', 'les_mine', 't_cafe', '사이즈·온도 바꿔 주문하기', 'N5'])
  assert.equal(row.lastMessageAt.getTime(), row.createdAt.getTime(), '#28 D9: 빈 대화도 목록 정렬에 바로')
  assert.deepEqual([dto.id, dto.kind, dto.scenarioId, dto.lessonId, dto.topic, dto.messageCount, dto.running], ['chat_rp_new', 'TALK', 'scn_seed', 'les_mine', { id: 't_cafe', title: '카페' }, 0, false])

  await createRolePlayChat(U, { kind: 'TALK', title: '내 제목', level: 'N4', topicId: 't_cafe', scenarioId: 'scn_seed', lessonId: null }, d)
  assert.deepEqual([created[1].title, created[1].level, created[1].lessonId], ['내 제목', 'N4', null])

  await assert.rejects(createRolePlayChat(U, { kind: 'CHAT', title: null, level: null, topicId: null, scenarioId: 'scn_seed', lessonId: null }, d), expectApi('VALIDATION', (e) => assert.equal(e.details?.field, 'kind')))
  assert.equal(created.length, 2, 'CHAT 은 판정 전에 거부(행 없음)')
})

test('역할극 대화 생성: learning 판정 404(남의 상황·레슨)는 그대로 전파되고 Chat 행을 만들지 않는다', async () => {
  const { d, created } = deps({
    resolveStart: async () => {
      throw new ApiError('NOT_FOUND', '상황을 찾을 수 없어요.')
    },
  })
  await assert.rejects(createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId: 'scn_theirs', lessonId: null }, d), expectApi('NOT_FOUND'))
  assert.equal(created.length, 0)
})

test('코치 강제 연결: 만든 역할극 대화(scenarioId 있음)는 설정이 유창성이어도 코치, 일반 TALK 는 설정 그대로', async () => {
  const { d, created } = deps()
  await createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId: 'scn_seed', lessonId: null }, d)
  assert.equal(resolveTalkCorrectionMode('FLUENCY', { scenarioId: created[0].scenarioId }), 'COACH')
  assert.equal(resolveTalkCorrectionMode(null, { scenarioId: created[0].scenarioId }), 'COACH')
  assert.equal(resolveTalkCorrectionMode('FLUENCY', { scenarioId: null }), 'FLUENCY')
})

// ── 종료 재료 읽기(가짜 tx) ───────────────────────────────────────────────

type ChatLock = { id: string; userId: string; kind: string; scenarioId: string | null; lessonId: string | null; topicId: string | null; createdAt: Date | string }

function factsTx(chat: ChatLock | null, messages: { content: string; createdAt: Date; toolLog: unknown }[], corrections: Record<string, number> = {}) {
  const calls: { op: string; sql?: string; args?: unknown }[] = []
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?')
      calls.push({ op: sql.includes('`User`') ? 'lockUser' : 'lockChat', sql, args: values })
      if (sql.includes('`User`')) return [{ id: values[0] }]
      return chat && chat.id === values[0] ? [chat] : []
    },
    chatMessage: {
      findMany: async (args: { where: { chatId: string; userId: string; role: string }; take: number }) => {
        calls.push({ op: 'msg.findMany', args })
        return messages.slice(0, args.take)
      },
      count: async () => {
        calls.push({ op: 'msg.count' })
        return messages.length
      },
    },
    correction: {
      groupBy: async (args: { where: Record<string, string> }) => {
        calls.push({ op: 'correction.groupBy', args })
        return Object.entries(corrections).map(([status, n]) => ({ status, _count: { _all: n } }))
      },
    },
  }
  return { tx: tx as unknown as Tx, calls }
}

const CHAT_CREATED = new Date('2026-10-06T09:58:00Z')
const CHAT: ChatLock = { id: 'chat_rp_1', userId: U, kind: 'TALK', scenarioId: 'scn_seed', lessonId: 'les_mine', topicId: 't_cafe', createdAt: CHAT_CREATED }
const coach = (id: string, hintKo: string | null, selfCheck: string | null) => ({ correction: { id, mode: 'COACH', deliver: 'NOW', hintKo, selfCheck } })

test('종료 재료: 사용자 → 대화 행 잠금 순서, 학습자 말·턴 수·힌트(코치 힌트 받은 말)·스스로 고침(SELF·REPEAT)·교정 수(상태 무관 제안 수)', async () => {
  const t0 = new Date('2026-10-06T10:00:00Z')
  const { tx, calls } = factsTx(
    CHAT,
    [
      { content: 'コーヒーをください', createdAt: t0, toolLog: coach('cr1', '조사를 다시 봐요', 'SELF') },
      { content: '大きいサイズにしてください', createdAt: new Date(t0.getTime() + 60_000), toolLog: coach('cr2', '사이즈 말하는 법', 'REPEAT') },
      { content: 'ありがとう', createdAt: new Date(t0.getTime() + 120_000), toolLog: coach('cr3', null, 'MISSED') },
      { content: 'はい', createdAt: new Date(t0.getTime() + 180_000), toolLog: null },
    ],
    { PROPOSED: 1, ACCEPTED: 1, REJECTED: 1, EXPIRED: 0 },
  )
  const f = await readRolePlayEndFacts(U, 'chat_rp_1', tx)
  assert.deepEqual(calls.slice(0, 2).map((c) => c.op), ['lockUser', 'lockChat'], '턴(acceptTurn)과 같은 잠금 순서')
  assert.ok(calls[1].sql?.includes('FOR UPDATE'))
  assert.ok(calls[1].sql?.includes('createdAt'), '대화 생성 시각을 같이 읽는다(끝낸 표식 조회 하한 — REV-134 M-2)')
  assert.ok(calls[1].sql?.includes('endedAt'), '잠근 행의 끝낸 표식(Chat.endedAt, task-048)을 같이 읽는다')
  assert.deepEqual((calls.find((c) => c.op === 'msg.findMany')!.args as { where: unknown }).where, { chatId: 'chat_rp_1', userId: U, role: 'USER' })
  assert.deepEqual(f, {
    chatId: 'chat_rp_1',
    chatCreatedAt: CHAT_CREATED,
    chatEndedAt: null,
    scenarioId: 'scn_seed',
    lessonId: 'les_mine',
    topicId: 't_cafe',
    turns: 4,
    learnerTexts: ['コーヒーをください', '大きいサイズにしてください', 'ありがとう', 'はい'],
    corrections: { proposed: 3, accepted: 1, ignored: 1 },
    hintsUsed: 2,
    selfCorrections: 2,
    startedAt: t0,
  })
  assert.ok(!calls.some((c) => c.op === 'msg.count'), '상한 아래면 따로 세지 않음')
  const asText = await readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...CHAT, createdAt: '2026-10-06T09:58:00.000Z' }, []).tx)
  assert.equal(asText.chatCreatedAt.getTime(), CHAT_CREATED.getTime(), '원시 쿼리 DATETIME 이 글로 와도 Date 로 맞춘다')
})

test('종료 재료 거부: 남의 대화·없는 대화 404(존재를 드러내지 않음), 상황 없는 TALK·CHAT 400', async () => {
  await assert.rejects(readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...CHAT, userId: OTHER }, []).tx), expectApi('NOT_FOUND', (e) => assert.equal(e.userMessage, '채팅을 찾을 수 없어요.')))
  await assert.rejects(readRolePlayEndFacts(U, 'chat_none', factsTx(CHAT, []).tx), expectApi('NOT_FOUND'))
  await assert.rejects(readRolePlayEndFacts(U, '', factsTx(CHAT, []).tx), expectApi('NOT_FOUND'))
  await assert.rejects(readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...CHAT, scenarioId: null }, []).tx), expectApi('VALIDATION', (e) => assert.equal(e.details?.reason, 'not_scenario')))
  await assert.rejects(readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...CHAT, kind: 'CHAT' }, []).tx), expectApi('VALIDATION'))
})

test('종료 재료: 학습자 말이 상한을 넘으면 앞쪽만 읽고 턴 수는 따로 센다', async () => {
  const many = Array.from({ length: ROLE_PLAY_TURNS_READ_MAX + 3 }, (_, i) => ({ content: `はい${i}`, createdAt: new Date(1_700_000_000_000 + i), toolLog: null }))
  const { tx, calls } = factsTx(CHAT, many)
  const f = await readRolePlayEndFacts(U, 'chat_rp_1', tx)
  assert.deepEqual([f.turns, f.learnerTexts.length], [ROLE_PLAY_TURNS_READ_MAX + 3, ROLE_PLAY_TURNS_READ_MAX])
  assert.ok(calls.some((c) => c.op === 'msg.count'))
})
