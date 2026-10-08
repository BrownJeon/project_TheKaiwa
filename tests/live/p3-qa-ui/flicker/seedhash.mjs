/** 기본 시드(주제·상황) 해시 — tests/live/p3-qa-ui/e/lib.mjs seedHash 와 같은 계산. 기대값 e826f3ef09237a9c. 읽기 전용. */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
const Q = process.env.Q ?? `${process.env.HOME}/.node-local/thekaiwa-qa046base`
const { PrismaClient } = createRequire(`${Q}/x.js`)('@prisma/client')
const prisma = new PrismaClient()
const topics = await prisma.conversationTopic.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { chunks: { orderBy: { id: 'asc' } } } })
const scenarios = await prisma.scenario.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { topics: { orderBy: { topicId: 'asc' } } } })
const norm = JSON.stringify({ topics, scenarios }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
const sha = createHash('sha256').update(norm).digest('hex').slice(0, 16)
console.log(JSON.stringify({ topics: topics.length, scenarios: scenarios.length, sha, ok: sha === 'e826f3ef09237a9c' }))
await prisma.$disconnect()
