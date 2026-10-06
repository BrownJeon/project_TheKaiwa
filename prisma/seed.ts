/**
 * TheKaiwa 시드 — 정본 docs/design/domain-model.md §7. **멱등**(재실행해도 결과 동일)이며,
 * 관리자가 이미 바꾼 설정(ConfigurationVersion 이 있는 행)은 덮어쓰지 않는다.
 *
 * 사용자 행은 미리 만들지 **않는다**(TheMeal 교훈): provider/oauthId 는 Google 첫 로그인 때 알 수 있는
 * 값이라, 가짜 값으로 먼저 만들면 `@@unique([provider, oauthId])` 와 어긋나 계정이 둘로 갈린다.
 * OWNER_EMAIL 계정은 첫 로그인 때 인증 콜백이 SUPER_ADMIN 으로 만든다(signup-gate). 그 뒤 다시
 * `npm run db:seed` 하면 OWNER 전용 단계(설정 기본 행·N5 단어 50)가 채워진다.
 *
 * 실행: 우분투 미러에서 `npm run db:seed`(NFS noexec — 루트에서 npx 금지).
 * 드라이런: `SEED_DRY_RUN=1 node --env-file=.env --import tsx prisma/seed.ts` — 주제·조각 계획만 출력(쓰기 0).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, Prisma, type Environment } from '@prisma/client'
import { seedLexicon } from './seed-lexicon'
import { seedTopics, type SeedTopicInput } from './seed-topics'
import { seedScenarios } from './seed-scenarios'

const prisma = new PrismaClient()
const data = (name: string) => JSON.parse(readFileSync(join(__dirname, 'seed-data', name), 'utf-8'))

type WordSeed = { surface: string; reading: string; meaning: string; partOfSpeech: string; chunkType: string | null; example: string; exampleKo: string }

async function seedEngines(envs: Environment[]) {
  const e = data('engines.json')
  for (const d of e.engines) {
    const row = { displayName: d.displayName, type: d.type, connectionTypes: d.connectionTypes, capabilities: d.capabilities, schemaVersion: d.schemaVersion }
    await prisma.engine.upsert({ where: { id: d.id }, update: row, create: { id: d.id, ...row } })
  }
  for (const env of envs) {
    for (const c of e.connections) {
      // 관리자가 콘솔에서 바꾼 connection(ConfigurationVersion 존재)은 건드리지 않는다.
      const found = await prisma.engineConnection.findUnique({ where: { environment_key: { environment: env, key: c.key } } })
      if (found) {
        const edited = await prisma.configurationVersion.count({ where: { environment: env, scope: 'ENGINE_CONNECTION', targetId: found.id } })
        if (edited > 0) continue
      }
      const row = { engineId: c.engineId, name: c.name, role: c.role, connectionType: c.connectionType, connection: c.connection, runtime: c.runtime, credentialRef: c.credentialRef }
      await prisma.engineConnection.upsert({ where: { environment_key: { environment: env, key: c.key } }, update: row, create: { environment: env, key: c.key, ...row } })
    }
    for (const p of e.fallbackPolicies) {
      const byKey = async (key: string) => (await prisma.engineConnection.findUniqueOrThrow({ where: { environment_key: { environment: env, key } } })).id
      const primaryConnectionId = await byKey(p.primary)
      const fallbackConnectionIds = await Promise.all((p.fallbacks as string[]).map(byKey))
      await prisma.engineFallbackPolicy.upsert({
        where: { environment_role: { environment: env, role: p.role } },
        update: {},
        create: { environment: env, role: p.role, primaryConnectionId, fallbackConnectionIds },
      })
    }
  }
  console.log(`[seed] 엔진 ${e.engines.length}종·connection ${e.connections.length}×${envs.length}환경·폴백 정책 ${e.fallbackPolicies.length}×${envs.length}`)
}

async function seedVoices() {
  const v = data('voices.json')
  for (const m of v.models) {
    await prisma.voiceModel.upsert({
      where: { id: m.id },
      update: {},
      // 첫 voices/sync 가 M4 /models/info 와 대조해 없는 모델은 ERROR 로 바꾼다(정본 §7-7).
      create: { id: m.id, engineId: 'style-bert-vits2', speakers: m.speakers, styles: m.styles, status: 'AVAILABLE' },
    })
  }
  for (const [i, p] of (v.profiles as { id: string; displayName: string; description: string; voiceModelId: string; speaker: string; speakerId: number }[]).entries()) {
    await prisma.voiceProfile.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, ttsEngineId: 'style-bert-vits2', defaults: v.defaults, status: 'AVAILABLE', enabled: true, sortOrder: i },
    })
    for (const s of v.styles) {
      await prisma.voiceStyle.upsert({
        where: { voiceProfileId_name: { voiceProfileId: p.id, name: s.name } },
        update: {},
        create: { voiceProfileId: p.id, name: s.name, label: s.label, sortOrder: s.sortOrder },
      })
    }
  }
  console.log(`[seed] Voice 모델 ${v.models.length}·프로필 ${v.profiles.length}`)
}

async function seedAppSettings(envs: Environment[]) {
  const rows: { key: string; value: Prisma.InputJsonValue; editability: 'RUNTIME_EDITABLE' | 'RESTART_REQUIRED'; description: string }[] = [
    { key: 'voice.preview.defaultText', value: 'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。', editability: 'RUNTIME_EDITABLE', description: '통합 미리듣기 문장(§43)' },
    { key: 'voice.preview.textVersion', value: 1, editability: 'RUNTIME_EDITABLE', description: '문장 변경 시 +1 → TtsCache 키 무효화(§44)' },
    { key: 'voice.default.profileId', value: 'teacher_haruka', editability: 'RUNTIME_EDITABLE', description: 'voiceProfileId null/비가용 시 대체' },
    { key: 'override.production.enabled', value: false, editability: 'RUNTIME_EDITABLE', description: 'Production 임시 Override 게이트(§106, SUPER_ADMIN)' },
    { key: 'speech.audio.retentionDays', value: 30, editability: 'RESTART_REQUIRED', description: 'Utterance 오디오 보존일' },
    { key: 'trace.retentionDays', value: 90, editability: 'RESTART_REQUIRED', description: 'RequestTrace 보존일' },
  ]
  for (const env of envs) {
    for (const r of rows) {
      // update: {} — 운영 중 바뀐 값은 보존한다.
      await prisma.appSetting.upsert({ where: { environment_key: { environment: env, key: r.key } }, update: {}, create: { environment: env, ...r } })
    }
  }
  console.log(`[seed] AppSetting ${rows.length}×${envs.length}환경`)
}

async function seedPromptTemplates() {
  const keys: [string, string][] = [
    ['talk', 'A1 회화 턴(응답+교정)'], ['chat', 'A2 채팅 턴'], ['chatReview', 'A3 표현 점검'], ['lesson', 'A4 오늘의 회화 레슨'],
    ['reviewMix', 'A5 복습 혼합'], ['evalGen', 'A6 평가 출제'], ['evalGrade', 'A7 평가 채점'], ['planAnalysis', 'A8 분석·계획서'],
    ['ask', 'A9 무엇이든 물어보세요'], ['wordEnrich', 'A10 단어 보강'], ['teacher-persona', '강사 페르소나(.claude/agents/tutor.md)'],
  ]
  for (const [key, description] of keys) {
    await prisma.promptTemplate.upsert({ where: { key }, update: {}, create: { key, description, ownerRole: 'prompt-engineer' } })
  }
  console.log(`[seed] PromptTemplate 키 ${keys.length}개 예약(본문은 prompts:sync, task-004)`)
}

/** OWNER 전용 단계 — 계정이 있을 때만(첫 로그인 뒤 재실행). */
async function seedOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
  if (!email) return console.log('[seed] OWNER_EMAIL 이 비어 있어 OWNER 단계를 건너뜁니다.')
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return console.log('[seed] OWNER 계정이 아직 없습니다 — 첫 Google 로그인 후 `npm run db:seed` 를 다시 실행하면 설정 기본 행·N5 단어 50개가 채워집니다.')
  if (user.role !== 'SUPER_ADMIN') await prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } })
  await prisma.profile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  await prisma.userVoiceSetting.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, voiceProfileId: 'teacher_haruka' } })
  await prisma.userSpeechSetting.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  const words: WordSeed[] = data('words-n5.json')
  let added = 0
  for (const w of words) {
    const exists = await prisma.wordEntry.findFirst({ where: { userId: user.id, surface: w.surface, source: 'SEED' }, select: { id: true } })
    if (exists) continue
    await prisma.wordEntry.create({
      data: { userId: user.id, surface: w.surface, reading: w.reading, meaning: w.meaning, partOfSpeech: w.partOfSpeech as never, chunkType: (w.chunkType ?? null) as never, jlpt: 'N5', example: w.example, exampleKo: w.exampleKo, category: 'N5 기초', source: 'SEED' },
    })
    added++
  }
  console.log(`[seed] OWNER(SUPER_ADMIN) 설정 기본 행 + N5 단어 ${added}개 추가(기존 ${words.length - added})`)
}

async function seedScenarioStep(topics: SeedTopicInput[], dryRun: boolean) {
  const file = join(__dirname, 'seed-data', 'scenarios.json')
  if (!existsSync(file)) return console.log('[seed] seed-data/scenarios.json 이 없어 상황 단계를 건너뜁니다.')
  await seedScenarios(prisma, data('scenarios.json'), topics, { dryRun })
}

async function main() {
  const envs: Environment[] = ['LOCAL', 'PRODUCTION']
  const topics: SeedTopicInput[] = data('topics.json')
  if (process.env.SEED_DRY_RUN === '1') {
    // 드라이런 — 주제·조각 계획만 출력하고 **아무것도 쓰지 않는다**(다른 시드 단계는 실행하지 않음).
    await seedTopics(prisma, topics, { dryRun: true })
    await seedScenarioStep(topics, true)
    console.log('[seed:dry-run] 주제·조각·상황 계획만 출력 — 쓰기 0, 엔진·Voice·AppSetting·발음 사전·PromptTemplate·OWNER 단계는 건너뜀')
    return
  }
  // 주제·조각은 안정 id upsert(prisma/seed-topics.ts) — 이미 있는 조각 id 를 바꾸지 않는다(RepetitionItem 이 가리킴).
  await seedTopics(prisma, topics)
  // 상황은 주제 다음(주제 연결 — prisma/seed-scenarios.ts, 안정 id `scn_<key>`). 파일이 없으면 건너뛴다(시드 JSON 은 PE 작성).
  await seedScenarioStep(topics, false)
  await seedEngines(envs)
  await seedVoices()
  await seedAppSettings(envs)
  await seedLexicon(prisma, envs, data('lexicon.json').entries)
  await seedPromptTemplates()
  await seedOwner()
}

main()
  .catch((e) => {
    console.error('[seed] 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
