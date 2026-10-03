'use client'

/**
 * Raw JSON 탭(#110·#111, DEVELOPER 이상 — ADMIN 에게는 탭 자체가 없다). 저장값(콘솔 적용값·연결 프로필 층)만 보여 주고,
 * [JSON 편집]을 켜야 고친다 — Form 과 같은 초안이다(고친 값은 Form 에 바로 보인다). 문법 오류면 Form 탭·[검증]이 잠긴다.
 * 휴대폰 폭 편집은 경고 띠만(사용자 결정 d2 = A — 막지 않는다). 가려진 값(•••)이 든 문서는 편집을 열지 않는다(되돌려 보내면 가림 글자가 저장된다).
 */
import type { ConfigRawDto } from '@/types/admin'
import { RULE_KO } from './configCopy'
import { hasMaskedValue, rawLineOf } from './draft'
import type { ConfigEditor } from './useConfigEditor'
import { LINK_SM, Note } from './ui'

const CODE = 'font-mono text-[16px] leading-6 lg:text-[13px] lg:leading-5'

export default function RawTab({ editor, raw, canEdit }: { editor: ConfigEditor; raw: ConfigRawDto; canEdit: boolean }) {
  const e = editor
  const text = e.raw.text ?? ''
  const lines = text.split('\n')
  const scope = raw.scope
  const errLines = new Set<number>()
  if (e.raw.editing && e.raw.syntax) errLines.add(e.raw.syntax.line)
  for (const k of Object.keys(e.errors)) {
    const n = rawLineOf(text, scope, k)
    if (n) errLines.add(n)
  }
  const masked = hasMaskedValue(raw.json)
  const errList = Object.values(e.errors)
  return (
    <>
      <div className="mt-2.5 rounded-[14px] bg-surface2 px-3 py-2.5">
        <p className="text-[13px] [overflow-wrap:anywhere]">
          저장값 JSON · {raw.version ? `v${raw.version}` : '버전 없음(초기값)'} · 스키마 <span className="font-mono">{raw.schemaRef ?? '—'}</span>
        </p>
        <p className="text-[12px] text-ink2 [overflow-wrap:anywhere]">
          콘솔 적용값·연결 프로필 층만(환경 변수·설정 파일 값 없음)
          {raw.effectiveDiffers.length ? (
            <>
              {' '}
              · 실제 값과 다른 키 <span className="font-mono">{raw.effectiveDiffers.join(', ')}</span>
            </>
          ) : null}
        </p>
      </div>
      {canEdit && !masked ? (
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-pressed={e.raw.editing}
            onClick={() => e.raw.toggle(!e.raw.editing)}
            className={`h-11 flex-none rounded-xl px-3 text-[13px] font-medium ${e.raw.editing ? 'bg-accent-soft text-ink ring-1 ring-accent' : 'bg-surface2 text-ink2'}`}
          >
            {e.raw.editing ? '✓ JSON 편집 중' : 'JSON 편집'}
          </button>
          <span className="min-w-0 flex-1 text-[12px] text-ink2 break-keep">{e.raw.editing ? 'Form 과 같은 초안이에요. 고친 값은 Form 에 바로 보여요.' : '읽기 전용으로 보고 있어요.'}</span>
        </div>
      ) : null}
      {canEdit && masked ? (
        <Note tone="neu" className="mt-2">
          가려진 값(•••)이 있는 문서라 JSON 편집을 열지 않아요 — Form 탭에서 바꿔 주세요.
        </Note>
      ) : null}
      {e.raw.editing ? (
        <Note tone="warn" role="note" className="mt-2 lg:hidden">
          <b>휴대폰에서는 실수하기 쉬워요</b> — 쉼표 하나로 전체가 깨져요. 가능하면 컴퓨터에서 고쳐 주세요(막지는 않아요).
        </Note>
      ) : null}
      {e.raw.editing && e.raw.syntax ? (
        <Note tone="bad" role="alert" className="mt-2">
          <b className="text-bad">
            JSON 문법 오류 — {e.raw.syntax.line}행 {e.raw.syntax.column}열 근처
          </b>
          <br />
          쉼표나 따옴표가 빠졌는지 확인해 주세요. 고치기 전까지 Form 탭과 [검증]이 잠겨요.
        </Note>
      ) : null}
      <div className="mt-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface">
        <div aria-hidden="true" className="select-none bg-surface2 py-2.5 text-right text-ink2">
          {lines.map((_, i) => (
            <span key={i} className={`block pl-2.5 pr-2 tabular-nums ${CODE} ${errLines.has(i + 1) ? 'bg-bad-soft font-bold text-bad' : ''}`}>
              {errLines.has(i + 1) ? '●' : ''}
              {i + 1}
            </span>
          ))}
        </div>
        {e.raw.editing ? (
          <textarea
            aria-label="설정 JSON"
            rows={Math.max(lines.length, 3)}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            value={text}
            onChange={(ev) => e.raw.setText(ev.target.value)}
            className={`block w-full min-w-0 resize-none overflow-x-auto overflow-y-hidden whitespace-pre border-0 bg-surface px-3 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${CODE}`}
          />
        ) : (
          <pre aria-label="설정 JSON(읽기 전용)" className={`m-0 min-w-0 overflow-x-auto whitespace-pre px-3 py-2.5 text-ink ${CODE}`}>
            {lines.map((l, i) => (
              <span key={i} className={`block min-h-6 lg:min-h-5 ${errLines.has(i + 1) ? 'bg-bad-soft' : ''}`}>
                {l}
              </span>
            ))}
          </pre>
        )}
      </div>
      {errList.length ? (
        <div role="alert" className="mt-2.5 rounded-[14px] border border-line bg-surface p-3.5">
          <p className="text-[13px] font-semibold text-bad">검증 실패 · {errList.length}건</p>
          <ul className="mt-2">
            {errList.map((er) => {
              const n = rawLineOf(text, scope, er.key)
              return (
                <li key={er.key} className="grid gap-0.5 border-t border-line py-2 text-[13px] first:border-t-0">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-bad-soft px-2 text-[11.5px] font-semibold text-bad">{n ? `${n}행` : '—'}</span>
                    <span className="min-w-0 font-mono text-[12.5px] [overflow-wrap:anywhere]">{er.key}</span>
                    <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-surface2 px-2 font-mono text-[11.5px] text-ink2" title={RULE_KO[er.rule] ?? er.rule}>
                      {er.rule}
                    </span>
                  </span>
                  <span className="break-keep">{er.message}</span>
                  {er.suggestion && e.raw.editing ? (
                    <span>
                      <button type="button" onClick={() => e.raw.suggest(er.key, er.suggestion!)} className={LINK_SM}>
                        {er.key.split('.').pop()} → {er.suggestion.split('.').pop()} 로 바꾸기
                      </button>
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-[12px] text-ink2 break-keep">
        맨 바깥의 x- 로 시작하는 키(예: <span className="font-mono">x-note</span>)는 메모로 둘 수 있지만 저장되지 않아요.
      </p>
    </>
  )
}
