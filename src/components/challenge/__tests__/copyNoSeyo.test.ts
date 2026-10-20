import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CREATE } from '../challengeCopy'

/**
 * 챌린지 안내 문구 가드 — 「세다(count)」의 해요체 「세요」(「이렇게 세요」·「합쳐서 세요」)는 존댓말 명령형(하세요)으로 읽혀 뜻이 안 통한다
 * (사용자 지적 2026-10-07, task-p2-copy-seyo). 계산·인정 뜻은 「계산해요」·「인정돼요」로 쓴다.
 * 사용자 화면에 나가는 문구 파일을 읽어 주석을 뺀 줄에서 옛 표현이 다시 들어오지 않게 지킨다.
 */
const ROOT = join(__dirname, '../../..')
const FILES = [
  'components/challenge/challengeCopy.ts',
  'components/challenge/logic.ts',
  'components/challenge/DayStrip.tsx',
  'components/vocab/topicCopy.ts',
  'components/plan/growthCopy.ts', // task-080 성장 탭(Leader 결정 L4) — plan/__tests__/growthCopy.test.ts 도 같은 규칙으로 막는다
]

// 「세다」 뜻의 「세요」/「세서」 — 앞말이 이 목록이면 count 뜻이다(「주세요」·「하세요」 같은 존댓말 명령형은 해당 없음).
// 「만·을·를」 은 task-080 감사 L3 — 승인 데모의 «…끝낸 역할극만 세요.»·«…기록(관측)을 세요.» 꼴이 되살아나지 않게.
const COUNT_SEYO = /(합쳐서|함께|공부해도|날만|이렇게|로|도|으로|만|을|를) 세요|시작한 날로 세서/

test('화면 문구 파일에 count 뜻 「세요」가 없다 (주석 제외)', () => {
  for (const f of FILES) {
    const lines = readFileSync(join(ROOT, f), 'utf-8').split('\n')
    lines.forEach((line, i) => {
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
      assert.ok(!COUNT_SEYO.test(line), `${f}:${i + 1} ${t.slice(0, 80)}`)
    })
  }
})

test('만들기 확인 단계 규칙 상자 — 제목은 「이렇게 계산해요」, 규칙 문장에 「세요」가 없다', () => {
  assert.equal(CREATE.rulesTitle, '이렇게 계산해요')
  for (const rule of CREATE.rules) assert.ok(!/세요/.test(rule), rule)
  assert.ok(CREATE.rules.some((r) => r.includes('인정돼요')))
})

test('셈 뜻 「세요」 정규식이 조사 「만·을·를」 꼴도 잡고, 존댓말 명령형은 잡지 않는다(감사 L3)', () => {
  for (const bad of ['끝낸 역할극만 세요.', '맞히고 틀린 기록(관측)을 세요.', '공부한 날을 세요', '횟수를 세요', '이렇게 세요', '합쳐서 세요']) assert.ok(COUNT_SEYO.test(bad), bad)
  for (const ok of ['다시 불러와 주세요.', '확인해 주세요', '골라 보세요', '하세요', '계산해요']) assert.ok(!COUNT_SEYO.test(ok), ok)
})
