/**
 * task-045 감사 보완(REV-152a M-1 · REV-152b L1·L3) — 메모리 가짜만(DB·LLM 0).
 * - #28 새 채팅 저장의 주제 FK 위반(P2003 topicId) → 404 `TOPIC_GONE`(잠금 없이 확인 뒤 삭제가 끼어든 경우).
 * - 학습자 글의 카드번호 모양 숫자열(13자리↑, 공백·하이픈 구분 포함) → `SECRET_LIKE` · 정상 숫자 글은 통과 · AI 출력 검사는 그대로.
 * - #170 `inFlight` 등록이 `try` 바로 앞(사이에서 던져 영구 DRAFT_BUSY 가 되는 간극 없음).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ApiError, type prisma } from '@/modules/infra'
import { createChat } from '../chats'
import { detectUnsafeTopicText, detectUnsafeUserTopicText } from '../structuredResponse/topicDraftSchemas'

type Row = Record<string, unknown>
const U = 'userA'
const reasonOf = (e: unknown) => (e instanceof ApiError ? `${e.code}:${String(e.details?.reason ?? '')}` : `raw:${(e as Error)?.message}`)
const fk = (field: string) => Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003', meta: { field_name: field } })

function chatDb(opts: { createError?: unknown; hidden?: boolean } = {}) {
  const log: string[] = []
  const db = {
    conversationTopic: { findFirst: async () => ({ id: 'topSeed', title: '카페', userId: null }) },
    userSeedOverride: { findFirst: async ({ where }: { where: Row }) => (opts.hidden && where.userId === U ? { id: 'ov1' } : null) },
    challenge: { findFirst: async () => null },
    chat: {
      create: async () => {
        log.push('chat.create')
        throw opts.createError
      },
    },
  } as unknown as typeof prisma
  return { db, log }
}
const input = { kind: 'CHAT' as const, title: null, topicId: 'topSeed', level: 'N5' as const }

test('REV-152a M-1 #28 새 채팅 — 저장 때 주제 FK 위반은 404 TOPIC_GONE · 다른 FK 는 그대로 · 가린 시드는 저장 전에 404', async () => {
  const gone = chatDb({ createError: fk('Chat_topicId_fkey (index)') })
  await assert.rejects(createChat(U, input, { db: gone.db }), (e: unknown) => reasonOf(e) === 'NOT_FOUND:TOPIC_GONE')
  assert.deepEqual(gone.log, ['chat.create'])
  const otherErr = fk('Chat_userId_fkey (index)')
  await assert.rejects(createChat(U, input, { db: chatDb({ createError: otherErr }).db }), (e: unknown) => e === otherErr)
  const hidden = chatDb({ hidden: true, createError: new Error('불리면 안 됨') })
  await assert.rejects(createChat(U, input, { db: hidden.db }), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  assert.deepEqual(hidden.log, [], '가린 시드는 저장 시도 0')
})

test('REV-152b L3 카드번호 모양 숫자열 — 13자리↑(공백·하이픈·전각 포함) SECRET_LIKE · 연도·전화·날짜 범위·번지·12자리 통과 · AI 출력 검사는 그대로', () => {
  const fw = (s: string) => [...s].map((ch) => (/[0-9]/.test(ch) ? String.fromCodePoint(ch.codePointAt(0)! + 0xfee0) : ch === '-' ? String.fromCodePoint(0xff0d) : ch)).join('')
  const bad = ['4111111111111111', '4111 1111 1111 1111', '4111-1111-1111-1111', '카드 4111 1111 1111 1111 결제', '3782-822463-10005', '1234567890123', fw('3782-822463-10005'), '1002-123-456789']
  for (const s of bad) assert.equal(detectUnsafeUserTopicText(s), 'SECRET_LIKE', JSON.stringify(s))
  const ok = ['2025년 여행', '010-1234-5678', '+82 10 1234 5678', '2025-10-07 2026-10-07', '123-45 번지', 'JR 5번 출구', '1,000円', '123456789012', '12 345 678 901 234', fw('2025'), '3층 301호 1004번 버스']
  for (const s of ok) assert.equal(detectUnsafeUserTopicText(s), null, JSON.stringify(s))
  assert.equal(detectUnsafeTopicText('4111111111111111'), null, 'AI 초안 검사(detectUnsafeTopicText)는 바꾸지 않았다')
  assert.equal(detectUnsafeUserTopicText('<b>4111111111111111'), 'MARKUP', '기존 검사가 먼저')
})

test('REV-152b L1 #170 inFlight 등록 — 확인(has) 뒤 await 없음 · 등록(add) 바로 다음 줄이 try', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/conversation/chats/topicDraft.ts'), 'utf8')
  const has = src.indexOf('if (inFlight.has(userId))')
  const add = src.indexOf('inFlight.add(userId)')
  assert.ok(has > 0 && add > has)
  assert.doesNotMatch(src.slice(has, add), /\bawait\b/, '확인과 등록 사이에 await 가 있으면 두 요청이 끼어든다')
  assert.match(src.slice(add), /^inFlight\.add\(userId\)\n\s*try \{/, '등록과 try 사이에 문장이 있으면 던질 때 영구 DRAFT_BUSY')
})
