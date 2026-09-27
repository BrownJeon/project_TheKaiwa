'use client'

/** 목록 머리 "문장으로 읽기 확인"(screens.md §10-2 E 끝) — 지금 사전으로 한 문장을 읽어 보고 틀린 단어를 찾는다. 접혀 있다. */
import type { AdminVoiceDto } from '@/types/admin'
import { PREVIEW } from './lexiconCopy'
import LexiconPreviewPanel from './LexiconPreviewPanel'

export default function LexiconSentenceCheck({ voices }: { voices: readonly AdminVoiceDto[] }) {
  return (
    <details className="mt-3 rounded-[14px] border border-line bg-surface">
      <summary className="flex h-12 cursor-pointer items-center px-3.5 text-[14px] font-medium">문장으로 읽기 확인</summary>
      <div className="px-3.5 pb-3">
        <p className="text-[12px] text-ink2 break-keep">{PREVIEW.sentenceHelp}</p>
        <LexiconPreviewPanel mode="current" initialText="" voices={voices} embedded />
      </div>
    </details>
  )
}
