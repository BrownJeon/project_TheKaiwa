'use client'

/**
 * 설정 맨 아래 「단어 자료 출처」 줄 + 출처 시트(task-051 §19-4 F-2, 데모 v1 D5-A). 웹·앱 모두 그린다.
 *
 * 주소는 링크로 만들지 않는다(글자만, 길게 눌러 복사) — 앱 WebView 가 바깥 사이트로 나가면 돌아오기 어렵다.
 * 예문 생성 입력에 쓰지 않은 자료(Tatoeba)는 적지 않는다(`prisma/seed-data/SOURCES.md`). 엔진·모델 이름 대신 「AI」 일반어만.
 * 합계는 단계별 생성 개수의 합이라 데이터를 다시 만들어도 문구를 고치지 않는다.
 */
import { useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, Section } from '@/components/common/ui'
import { fmtCount, seedPackTotal } from '@/components/vocab/labels'

export const DATA_CREDIT = {
  title: '단어 자료 출처',
  rowSub: 'OpenJLPT 외 · CC BY-SA 4.0',
  /** 홀수 칸은 굵게. */
  introParts: (total: number) => ['다섯 단계 기본 단어 ', `${fmtCount(total)}`, '개는 공개 자료 ', 'OpenJLPT', ' 를 바탕으로 만들었어요.'],
  notOfficial: 'JLPT 공식 단어 목록이 아니에요. 급수는 공개 자료가 추정한 값이에요.',
  sources: [
    { name: 'OpenJLPT', by: 'evanclan · CC BY-SA 4.0', at: 'github.com/evanclan/OpenJLPT' },
    { name: 'JLPT 급수 단어 목록', by: 'Jonathan Waller (Tanos) · CC BY', at: 'tanos.co.uk/jlpt' },
    { name: 'JMdict 사전', by: 'EDRDG · CC BY-SA 4.0', at: 'edrdg.org' },
  ],
  aiNote: '한국어 뜻·예문은 AI 가 새로 썼고, 사람은 일부만 확인했어요. 틀린 곳이 보이면 단어를 눌러 고칠 수 있어요.',
  license: '이 앱의 기본 단어 자료도 같은 CC BY-SA 4.0 으로 둬요.',
  licenseAt: 'creativecommons.org/licenses/by-sa/4.0',
  close: '닫기',
} as const

export function DataCreditBody({ onClose }: { onClose: () => void }) {
  const c = DATA_CREDIT
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-[14px] break-keep">
        {c.introParts(seedPackTotal()).map((t, i) =>
          i % 2 === 1 ? (
            <b key={i} className="font-semibold">
              {t}
            </b>
          ) : (
            <span key={i}>{t}</span>
          ),
        )}
      </p>
      <p className="text-[13px] text-ink2 break-keep">{c.notOfficial}</p>
      <dl className="flex min-w-0 flex-col gap-2.5">
        {c.sources.map((s) => (
          <div key={s.name} className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5">
            <dt className="text-[14px] font-semibold break-keep">{s.name}</dt>
            <dd className="text-[12.5px] text-ink2 break-keep">{s.by}</dd>
            <dd className="font-mono text-[12px] text-ink2 select-all [overflow-wrap:anywhere]">{s.at}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] text-ink2 break-keep">{c.aiNote}</p>
      <div className="min-w-0">
        <p className="text-[13px] text-ink2 break-keep">{c.license}</p>
        <p className="font-mono text-[12px] text-ink2 select-all [overflow-wrap:anywhere]">{c.licenseAt}</p>
      </div>
      <Btn variant="ghost" className="w-full" onClick={onClose}>
        {c.close}
      </Btn>
    </div>
  )
}

export default function DataCreditRow() {
  const [open, setOpen] = useState(false)
  return (
    <Section>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-[56px] w-full min-w-0 items-center justify-between gap-3 rounded-[14px] border border-line bg-surface p-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-[14px] text-ink">{DATA_CREDIT.title}</span>
          <span className="block truncate text-[12px] text-ink2">{DATA_CREDIT.rowSub}</span>
        </span>
        <span aria-hidden="true" className="flex-none text-[18px] text-ink2">
          ›
        </span>
      </button>
      <Sheet open={open} title={DATA_CREDIT.title} onClose={() => setOpen(false)}>
        <DataCreditBody onClose={() => setOpen(false)} />
      </Sheet>
    </Section>
  )
}
