/**
 * qa-045-ui-d — QA1 계정 task-045 관련 행 수(기준선) + 시드 해시. 읽기 전용.
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d && node --env-file=.env <이 파일>
 */
import { prisma, qaUser, QA1, qaRowCounts, seedHash } from './lib.mjs'

const u = await qaUser(QA1)
const counts = await qaRowCounts(u.id)
const todayTopics = await prisma.conversationTopic.findMany({ where: { userId: u.id }, select: { id: true, title: true, createdAt: true } })
const sh = await seedHash()
console.log(JSON.stringify({ qa1: u.id, counts, topicsDetail: todayTopics.map((t) => ({ id: t.id, title: t.title, at: t.createdAt })), seed: sh }, null, 1))
await prisma.$disconnect()
