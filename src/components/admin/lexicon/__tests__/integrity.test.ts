import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Err } from '@/components/common/errors'
import type { LexiconSnapshotIntegrity, LexiconVersionDto } from '@/types/lexicon'
import { ConsoleProvider } from '../../console/ConsoleProvider'
import { IntegrityBadge } from '../Badges'
import { integrityErrorIsTarget, integrityErrorText, isSnapshotIntegrityError, versionCountText, writeErrorNotice } from '../lexiconCopy'
import { rollbackSlot, VersionHead, VersionLoadError } from '../VersionDetailSheet'
import VersionRow from '../VersionRow'

// 스냅샷 무결성(A Codex C2, 31bbc5f): OK 가 아니면 "기록 손상" + 되돌리기 숨김, 422 E_SNAPSHOT_INTEGRITY 는 시트 안 안내만.

const DAMAGED: Exclude<LexiconSnapshotIntegrity, 'OK'>[] = ['MALFORMED', 'INVALID_ENTRIES', 'MISMATCH']
const text = (html: string) => html.replace(/<[^>]+>/g, '')

const version = (p: Partial<LexiconVersionDto>): LexiconVersionDto => ({
  version: 7,
  status: 'SUPERSEDED',
  createdAt: '2026-09-28T00:00:00.000Z',
  actor: { name: 'QA', role: 'DEVELOPER' },
  changeSummary: '추가 1',
  entryCount: 8,
  enabledCount: 6,
  snapshotHash: 'a'.repeat(64),
  integrity: 'OK',
  reason: null,
  action: 'lexicon.create',
  restoredFrom: null,
  ...p,
})

const err = (status: number, details: Record<string, unknown>, code: string | null = 'UNPROCESSABLE'): Err => ({ status, message: '서버 문구', code, details, retryAfterSec: null })

test('"기록 손상" 뱃지: OK·값 없음은 그리지 않고, 손상 3종은 뜻을 aria-label 로', () => {
  assert.equal(renderToStaticMarkup(createElement(IntegrityBadge, { integrity: 'OK' })), '')
  assert.equal(renderToStaticMarkup(createElement(IntegrityBadge, { integrity: undefined })), '')
  const why: Record<string, RegExp> = { MALFORMED: /형식/, INVALID_ENTRIES: /규칙/, MISMATCH: /해시/ }
  for (const i of DAMAGED) {
    const html = renderToStaticMarkup(createElement(IntegrityBadge, { integrity: i }))
    assert.match(text(html), /^기록 손상$/, i)
    assert.match(html, new RegExp(`aria-label="기록 손상: [^"]*${why[i].source}`), i)
  }
})

test('버전 행: 손상이면 뱃지 + 항목 수 뜻(손상 행 포함·멀쩡한 사용 중), OK 면 뱃지 없음', () => {
  const ok = text(renderToStaticMarkup(createElement(VersionRow, { v: version({}), now: 0, onOpen: () => undefined })))
  assert.doesNotMatch(ok, /기록 손상/)
  assert.match(ok, /항목 8개\(사용 중 6\)/)
  for (const i of DAMAGED) {
    const t = text(renderToStaticMarkup(createElement(VersionRow, { v: version({ integrity: i }), now: 0, onOpen: () => undefined })))
    assert.match(t, /기록 손상/, i)
    assert.match(t, /항목 8개\(손상 행 포함\) · 멀쩡한 사용 중 6/, i)
  }
  assert.equal(versionCountText({ entryCount: 3, enabledCount: 3 }), '항목 3개(사용 중 3)')
})

test('되돌리기 버튼: integrity 값마다 — OK 만 버튼, 손상 3종은 "damaged"(버튼 없음), 사용 중 버전은 손상이어도 "current"', () => {
  assert.equal(rollbackSlot(version({ integrity: 'OK' }), 9, true), 'button')
  for (const i of DAMAGED) {
    assert.equal(rollbackSlot(version({ integrity: i }), 9, true), 'damaged', i)
    assert.equal(rollbackSlot(version({ integrity: i }), 9, false), 'damaged', `${i} 보기 전용`)
    assert.equal(rollbackSlot(version({ integrity: i, status: 'ACTIVE', version: 9 }), 9, true), 'current', `${i} 사용 중`)
  }
  // 목록은 OK 였지만 상세 요청이 이 버전 자체를 손상이라고 거절한 경우
  assert.equal(rollbackSlot(version({ integrity: 'OK' }), 9, true, true), 'damaged')
})

test('버전 머리: 손상이면 뱃지 + 뜻 한 줄 + 항목 수 뜻', () => {
  const access = { role: 'DEVELOPER' as const, capabilities: [], environment: 'LOCAL' as const, appVersion: null, menu: [] }
  // children 은 세 번째 인자로(react/no-children-prop) — props 타입이 children 을 필수로 요구해 단언한다.
  const inConsole = (v: LexiconVersionDto) =>
    renderToStaticMarkup(createElement(ConsoleProvider, { access } as unknown as Parameters<typeof ConsoleProvider>[0], createElement(VersionHead, { v })))
  const t = text(inConsole(version({ integrity: 'MISMATCH' })))
  assert.match(t, /기록 손상/)
  assert.match(t, /내용이 저장된 기록\(해시\)과 달라요/)
  assert.match(t, /손상 행 포함/)
  const ok = text(inConsole(version({})))
  assert.doesNotMatch(ok, /기록 손상|손상 행/)
})

test('422 E_SNAPSHOT_INTEGRITY: 시트 안 안내만(재시도·빈 diff 없음), 대상/직전 버전 구분', () => {
  const self = err(422, { reason: 'E_SNAPSHOT_INTEGRITY', version: 7, integrity: 'MISMATCH', issues: [] })
  assert.equal(isSnapshotIntegrityError(self), true)
  assert.equal(isSnapshotIntegrityError(err(422, { reason: 'E_IMPORT_FORMAT' })), false)
  assert.equal(isSnapshotIntegrityError(err(409, { reason: 'E_SNAPSHOT_INTEGRITY' })), false)
  const html = renderToStaticMarkup(createElement(VersionLoadError, { err: self, target: 7, onRetry: () => undefined }))
  assert.match(html, /role="alert"/)
  assert.match(text(html), /^v7 기록이 손상돼 비교·되돌리기를 할 수 없어요\. 올바른 내보내기 파일이 있으면 가져오기로 복구해 주세요\.$/)
  assert.doesNotMatch(html, /다시 시도|바뀐 항목이 없어요|<ul/)
  assert.doesNotMatch(text(html), /서버 문구/)
  assert.equal(integrityErrorIsTarget(self, 7), true)

  const prev = err(422, { reason: 'E_SNAPSHOT_INTEGRITY', version: 6, integrity: 'MALFORMED' })
  assert.equal(integrityErrorText(prev, 7), '직전 버전 v6 기록이 손상돼 비교할 수 없어요.')
  assert.equal(integrityErrorIsTarget(prev, 7), false)
  assert.equal(integrityErrorIsTarget(err(422, { reason: 'E_SNAPSHOT_INTEGRITY' }), 7), true, '번호가 없으면 보고 있는 버전으로 본다')

  const n = writeErrorNotice(self, 'rollback')
  assert.equal(n.text, 'v7 기록이 손상돼 되돌릴 수 없어요. 올바른 내보내기 파일이 있으면 가져오기로 복구해 주세요.')
  assert.equal(n.action, undefined, '다시 불러와도 풀리지 않으므로 보조 버튼 없음')
})
