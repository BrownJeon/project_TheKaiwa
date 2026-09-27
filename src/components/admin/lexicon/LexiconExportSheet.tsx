'use client'

/**
 * 내보내기 시트(screens.md §10-2 H). 보기 전용 역할도 쓴다(`voices.read`). 사용 중 사전 전체(꺼진 항목 포함)를 CSV·JSON 으로.
 * 성공해도 시트를 닫지 않는다(다른 형식도 받을 수 있게). 앱 WebView 는 파일 저장이 안 될 수 있어 앱에서만 안내 한 줄.
 */
import { useState } from 'react'
import { isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { isNativeApp } from '@/modules/infra/native'
import type { AdminEnvironment } from '@/types/admin'
import type { LexiconFormat } from '@/types/lexicon'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { ConsoleError } from '../console/ConsoleStates'
import { downloadExport } from './lexiconApi'

export function exportErrorText(status: number): string {
  if (status === 0) return '연결하지 못했어요. 네트워크를 확인해 주세요.'
  if (status === 403) return '내보내기 권한이 없어요 (voices.read).'
  return '내려받지 못했어요. 잠시 뒤 다시 눌러 주세요.'
}

export default function LexiconExportSheet({
  env,
  dictionaryVersion,
  total,
  onClose,
  toast,
}: {
  env: AdminEnvironment
  dictionaryVersion: number | null
  total: number | null
  onClose: () => void
  toast: (msg: string) => void
}) {
  const [format, setFormat] = useState<LexiconFormat>('csv')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [native] = useState(() => isNativeApp())

  const download = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await downloadExport(format, env, dictionaryVersion)
      toast(`내려받았어요 · v${dictionaryVersion ?? 0}`)
    } catch (e) {
      if (isAbort(e)) return
      setError(exportErrorText(toErr(e).status))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open title="사전 내보내기" onClose={onClose} dismissible={!busy}>
      <p className="text-[14px] break-keep">
        지금 쓰는 {env} 사전{dictionaryVersion !== null ? ` v${dictionaryVersion}` : ''} 전체({total !== null ? `꺼진 항목 포함 ${total}개` : '꺼진 항목 포함'})를
        내려받아요. 이 파일을 그대로 가져오면 바뀌는 것이 없어요.
      </p>
      <ConsoleSegmented
        ariaLabel="파일 형식"
        options={[
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON' },
        ]}
        value={format}
        onChange={setFormat}
        className="mt-3"
      />
      <p className="mt-1 text-[12px] text-ink2">{format === 'csv' ? '엑셀·스프레드시트에서 열 수 있어요.' : '다른 도구나 백업에 쓰기 좋아요.'}</p>
      {native ? <p className="mt-2 text-[12px] text-ink2 break-keep">앱에서는 파일 저장이 안 될 수 있어요. 안 되면 컴퓨터 브라우저에서 내려받아 주세요.</p> : null}
      {error ? (
        <div className="mt-2">
          <ConsoleError message={error} />
        </div>
      ) : null}
      <BtnRow>
        <Btn variant="primary" aria-busy={busy} onClick={() => void download()}>
          {busy ? '만드는 중…' : '내려받기'}
        </Btn>
        <Btn variant="ghost" onClick={onClose} disabled={busy}>
          닫기
        </Btn>
      </BtnRow>
    </Sheet>
  )
}
