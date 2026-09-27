/** 목록 액션 줄(screens.md §10-2 A). 쓰기 버튼은 `canWrite` 일 때만 DOM 에 있다(보기 전용·PRODUCTION 비 SUPER_ADMIN 은 내보내기만). */
import { Btn } from '@/components/common/ui'
import type { LexiconAccess } from './useLexiconAccess'

export default function LexiconActions({ access, onAdd, onImport, onExport }: { access: Pick<LexiconAccess, 'canWrite'>; onAdd: () => void; onImport: () => void; onExport: () => void }) {
  return (
    <div className="@container mt-3">
      <div className="flex flex-col gap-2 @min-[720px]:flex-row">
        {access.canWrite ? (
          <Btn variant="primary" className="w-full @min-[720px]:w-auto" onClick={onAdd}>
            ＋ 항목 추가
          </Btn>
        ) : null}
        <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 @min-[720px]:[&>*]:flex-none">
          {access.canWrite ? (
            <Btn variant="ghost" onClick={onImport}>
              가져오기
            </Btn>
          ) : null}
          <Btn variant="ghost" onClick={onExport}>
            내보내기
          </Btn>
        </div>
      </div>
    </div>
  )
}
