import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { filterTableRows, loadPersona, resetPersonaCache, splitSections } from '../persona/loader'

test('실제 tutor.md 는 필수 절 1~9 를 갖고 TALK 필터 결과가 예산 안이다', () => {
  resetPersonaCache()
  const p = loadPersona({ sections: [1, 3, 4, 6], level: 'N5', mode: 'TALK' })
  assert.equal(p.name, 'tutor')
  assert.match(p.prompt, /^## 1\./)
  assert.ok(!p.prompt.includes('## 2.'), '절 필터: 2절 제외')
  assert.ok(p.prompt.includes('| N5 입문'), '수준 행 유지')
  assert.ok(!p.prompt.includes('| N4 초급'), '다른 수준 행 제거')
  assert.ok(p.prompt.includes('| TALK |'), 'TALK 행 유지')
  assert.ok(!p.prompt.includes('| LESSON |'), '다른 모드 행 제거')
  console.info(`[persona] TALK 페르소나 ${p.prompt.length}자`)
  assert.ok(p.prompt.length <= 2_800, `TALK 페르소나 ${p.prompt.length}자 — 예산 초과`)
})

test('필수 절이 빠진 파일은 캐시가 없으면 fail-closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'persona-'))
  const f = join(dir, 'tutor.md')
  writeFileSync(f, `---\nname: tutor\n---\n## 1. 정체성\n${'가'.repeat(4000)}`)
  const prev = process.env.TUTOR_PERSONA_PATH
  process.env.TUTOR_PERSONA_PATH = f
  resetPersonaCache()
  try {
    assert.throws(() => loadPersona(), /필수 절 누락/)
  } finally {
    if (prev === undefined) delete process.env.TUTOR_PERSONA_PATH
    else process.env.TUTOR_PERSONA_PATH = prev
    resetPersonaCache()
  }
})

test('표 행 필터는 머리행·구분행과 표 밖 줄을 보존한다', () => {
  const sec = ['## 6. 모드', '| 모드 | 내용 |', '|---|---|', '| TALK | a |', '| CHAT | b |', '', '- 비고'].join('\n')
  const out = filterTableRows(sec, (c) => c === 'CHAT')
  assert.equal(out, ['## 6. 모드', '| 모드 | 내용 |', '|---|---|', '| CHAT | b |', '', '- 비고'].join('\n'))
  assert.equal(splitSections('서문\n## 1. a\nx\n## 2. b\ny').get(2), '## 2. b\ny')
})
