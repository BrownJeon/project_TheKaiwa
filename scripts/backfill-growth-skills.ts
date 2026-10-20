/**
 * 성장 탭 공부결과 DAILY `data.skills` 과거 백필(task-080, docs/screens.md §36-8) — 칸이 생기기 전의 관측을 다시 세어 모자란 만큼만 더한다.
 *
 *   node --import tsx scripts/backfill-growth-skills.ts                          # 기본 dry-run: 읽기만, 숫자 보고서만 출력
 *   node --import tsx scripts/backfill-growth-skills.ts --apply [--backup-dir=D] # 백업 파일을 먼저 쓰고 사용자별 트랜잭션으로 top-up
 *
 * - 계산·실행 규칙은 `src/modules/learning/snapshots/backfillSkills.ts`(top-up `max(0, R − C)` · 날짜 묶기 · 잠금 순서 · 멱등).
 *   `fromCorrection` 칸(§36-17-2 C 규칙)도 같은 top-up 으로 채운다 — 칸이 없는 옛 행은 C = 0 으로 본다.
 * - **기존 DAILY 행만 갱신한다** — 행이 없는 (사용자×날짜)는 만들지 않고 «건너뜀(행 없음)» 으로만 센다(Leader 결정 2026-10-21).
 * - 출력은 숫자만 — 계정은 순번(#1~#n). userId·이름·이메일·연결 문자열·대화 내용은 출력하지 않는다.
 * - `--apply` 는 운영 DB 쓰기다(개발·운영이 같은 NAS MariaDB). **사용자 승인 뒤에만**(Leader → deployer). 구현 단계에서는 실행하지 않는다.
 *
 * 백업(`--apply` 때 쓰기 전에 한 번): `<backup-dir>/growth-skills-backup-<UTC 시각>.json`(기본 `./backups`, 같은 이름이 있으면 실패, 권한 600).
 *   **운영에서는 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 를 쓴다** — 기본 `./backups` 는 실행 폴더(릴리스 폴더) 안이라
 *   다음 배포 정리 때 함께 지워진다. `backups/` 는 `.gitignore` 에 있다(실수 커밋 방지).
 *   `{kind, createdAt, rows:[{userId, periodKey, id, data, plannedAdd}]}` — 바꿀 기존 행의 적용 직전 `data` 전체.
 *   백업 쓰기가 실패하면 아무것도 쓰지 않는다. 백업 파일에는 userId·행 id 가 있으니 복원 뒤 지운다(저장소에 커밋 금지).
 *
 * 복원(필요할 때만 — 백필이 바꾸는 것은 `data.skills` 하나뿐이라 그 키만 되돌린다. 다른 칸의 그 사이 증가는 그대로 남는다):
 *   - `data` 에 `skills` 가 있던 행:  UPDATE StatsSnapshot SET data = JSON_SET(data, '$.skills', JSON_EXTRACT('<rows[i].data.skills 의 JSON>', '$'))
 *                                     WHERE id = '<rows[i].id>' AND kind = 'DAILY';
 *   - `skills` 가 없던 행:            UPDATE StatsSnapshot SET data = JSON_REMOVE(data, '$.skills') WHERE id = '<rows[i].id>' AND kind = 'DAILY';
 *   주의: 백업 뒤 실시간으로 더해진 `skills` 증가분은 복원으로 사라진다(배포 뒤 곧바로 되돌릴 때만 정확). 늦게 되돌릴 때는 `plannedAdd` 만큼만 빼는 편이 정확하다.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { formatGrowthSkillsBackfillReport, runGrowthSkillsBackfill, type BackfillTxRunner, type GrowthSkillsBackup } from '@/modules/learning'

export interface BackfillArgs {
  apply: boolean
  backupDir: string
}

export function parseBackfillArgs(argv: readonly string[], cwd: string = process.cwd()): BackfillArgs | { error: string } {
  let apply = false
  let backupDir = path.join(cwd, 'backups')
  const unknown: string[] = []
  for (const a of argv) {
    if (a === '--apply') apply = true
    else if (a.startsWith('--backup-dir=') && a.length > '--backup-dir='.length) backupDir = path.resolve(cwd, a.slice('--backup-dir='.length))
    else unknown.push(a)
  }
  if (unknown.length) return { error: `unknown argument(s): ${unknown.join(' ')} — use nothing, --apply, --backup-dir=<dir>` }
  return { apply, backupDir }
}

/** 운영 실행 때 백업 폴더(릴리스 폴더 밖) — dry-run 마지막 줄에 안내한다. */
export const PROD_BACKUP_DIR = '/home/brownjeon/apps/thekaiwa/shared/backups'

/** dry-run 보고서 끝에 붙이는 안내 줄(숫자 외 유일한 글 — 경로만, 개인정보 없음). */
export function backupDirHint(args: BackfillArgs): string {
  return `backup dir for --apply: ${args.backupDir} (production: run with --backup-dir=${PROD_BACKUP_DIR} — the default ./backups sits in the release folder and is removed by later deploys)`
}

export function backupFileName(createdAt: string): string {
  return `growth-skills-backup-${createdAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.json`
}

async function writeBackup(dir: string, b: GrowthSkillsBackup): Promise<string> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const file = path.join(dir, backupFileName(b.createdAt))
  await writeFile(file, JSON.stringify(b, null, 2), { flag: 'wx', mode: 0o600 })
  return file
}

async function main(): Promise<void> {
  const args = parseBackfillArgs(process.argv.slice(2))
  if ('error' in args) {
    console.error(args.error)
    process.exitCode = 2
    return
  }
  const { prisma, withTransaction } = await import('@/modules/infra')
  const transaction: BackfillTxRunner = (fn, opts) => withTransaction(fn, opts)
  try {
    const report = await runGrowthSkillsBackfill({ db: prisma, transaction, backup: (b) => writeBackup(args.backupDir, b) }, { apply: args.apply })
    for (const line of formatGrowthSkillsBackfillReport(report)) console.log(line)
    if (!args.apply) console.log(backupDirHint(args))
  } finally {
    await prisma.$disconnect()
  }
}

// 시험이 import 할 때는 실행하지 않는다(직접 실행할 때만).
if (process.argv[1]?.endsWith('backfill-growth-skills.ts')) {
  main().catch((e: unknown) => {
    // 오류 메시지 본문은 접속 정보를 담을 수 있어 이름·코드만.
    const code = typeof (e as { code?: unknown })?.code === 'string' ? ` ${(e as { code: string }).code}` : ''
    console.error(`backfill failed: ${e instanceof Error ? e.name : 'Error'}${code}`)
    process.exitCode = 1
  })
}
