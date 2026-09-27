/**
 * 발음 사전 시드(speech-platform/16 §2.1·§2.3) — GLOBAL 항목 + 버전 1(ACTIVE) 스냅샷.
 * **환경에 사전 버전이 하나라도 있으면 건드리지 않는다**(관리자가 게시·롤백한 사전을 시드가 덮지 않게, 멱등).
 * snapshotHash 는 앱 `src/modules/speech/tts/lexicon.ts#snapshotHash` 와 같은 규칙이다(단위 테스트가 대조).
 */
import { createHash } from 'node:crypto'
import type { Environment, PrismaClient } from '@prisma/client'

export interface SeedLexiconEntry {
  surface: string
  reading: string
  accentType: number
  priority: number
  wordType: string | null
  note: string | null
}

type SnapshotRow = { surface: string; reading: string; accentType: number; priority: number; scope: 'GLOBAL'; scopeRefId: null; wordType: string | null; enabled: boolean }

export function lexiconSnapshotHash(rows: readonly SnapshotRow[]): string {
  const canon = rows
    .filter((e) => e.enabled)
    .map((e) => [e.scope, e.scopeRefId ?? '', e.surface, e.reading, e.accentType, e.priority, e.wordType ?? ''].join('\u0001'))
    .sort()
  return createHash('sha256').update(canon.join('\u0002')).digest('hex')
}

export function toSnapshot(entries: readonly SeedLexiconEntry[]): SnapshotRow[] {
  return entries.map((e) => ({ surface: e.surface, reading: e.reading, accentType: e.accentType, priority: e.priority, scope: 'GLOBAL', scopeRefId: null, wordType: e.wordType, enabled: true }))
}

export async function seedLexicon(prisma: PrismaClient, envs: Environment[], entries: readonly SeedLexiconEntry[]): Promise<void> {
  const snapshot = toSnapshot(entries)
  const snapshotHash = lexiconSnapshotHash(snapshot)
  for (const environment of envs) {
    const versions = await prisma.pronunciationLexiconVersion.count({ where: { environment } })
    if (versions > 0) {
      console.log(`[seed] 발음 사전(${environment}) — 버전 ${versions}개가 이미 있어 건드리지 않습니다`)
      continue
    }
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        const found = await tx.pronunciationLexiconEntry.findFirst({ where: { environment, scope: 'GLOBAL', scopeRefId: null, surface: e.surface }, select: { id: true } })
        const data = { reading: e.reading, accentType: e.accentType, priority: e.priority, wordType: e.wordType, note: e.note, enabled: true }
        if (found) await tx.pronunciationLexiconEntry.update({ where: { id: found.id }, data })
        else await tx.pronunciationLexiconEntry.create({ data: { environment, scope: 'GLOBAL', scopeRefId: null, surface: e.surface, ...data } })
      }
      await tx.pronunciationLexiconVersion.create({
        data: { environment, version: 1, snapshotHash, snapshot, changeSummary: '시드 v1(task-003d)', actorUserId: null, status: 'ACTIVE' },
      })
    })
    console.log(`[seed] 발음 사전(${environment}) — 항목 ${entries.length}개 + 버전 1(ACTIVE)`)
  }
}
