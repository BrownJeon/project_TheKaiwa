/**
 * APK 업데이트 띠·설치 방법 시트·앱 버전 줄 문구(docs/screens.md §11-8 ⓗ). 엔진명 없음.
 */
export const APP_UPDATE_COPY = {
  recommendedTitle: (latest: string) => `새 앱 버전이 있어요 · v${latest}`,
  recommendedSub: '눌러서 바뀐 점·설치 방법 보기',
  download: '받기',
  dismissLabel: '오늘은 그만 보기',
  forcedTitle: '앱을 업데이트해 주세요',
  forcedBody: (mine: string) => `이 버전(v${mine})은 더 이상 지원하지 않아요. 일부 기능이 멈출 수 있어요.`,
  forcedButton: '업데이트',
  sheetTitle: '앱 업데이트',
  sheetHead: (mine: string, latest: string) => `v${mine} → v${latest}`,
  sheetMeta: (date: string | null, size: string | null) => [date ? `${date} 올라온 버전` : null, size ? `약 ${size}` : null].filter(Boolean).join(' · '),
  notesTitle: '바뀐 점',
  stepsTitle: '설치 방법',
  steps: [
    '[업데이트 받기]를 누르면 Chrome 창에서 파일을 받아요.',
    '다 받으면 알림(또는 Chrome ‘다운로드’)에서 받은 파일을 눌러요.',
    '‘출처를 알 수 없는 앱’ 설치를 물으면 Chrome 을 허용해 주세요(처음 한 번만).',
    '[업데이트]를 누르면 끝나요. 로그인과 받아 둔 휴대폰 인식 파일은 그대로 남아요.',
  ],
  getUpdate: '업데이트 받기',
  gettingUpdate: 'Chrome 창에서 받는 중이에요',
  later: '나중에',
  installFail: '‘앱이 설치되지 않았습니다’가 나오면 기존 앱을 지우고 다시 설치해야 해요. 이때는 로그인과 휴대폰 인식 파일 받기를 다시 해야 해요.',
  openFail: 'Chrome 창을 열지 못했어요. 잠시 후 다시 눌러 주세요.',
  versionLabel: '앱 버전',
  versionLatest: (mine: string) => `${mine} · 최신`,
  versionNew: (mine: string, latest: string) => `${mine} · 새 버전 ${latest} ›`,
  versionForced: (mine: string) => `${mine} · 업데이트 필요 ›`,
} as const

/** `2026-09-28T…Z` → "9월 28일"(KST). 형식이 다르면 null. */
export function publishedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}
