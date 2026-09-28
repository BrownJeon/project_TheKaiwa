/**
 * 앱(플러그인·다운로드 배너)에 내보내는 **절대 URL 의 origin**.
 *
 * 운영(`NODE_ENV=production`)은 정식 공개 주소 `OAUTH_CALLBACK_BASE`(https 만) — nginx 뒤에서 `req.nextUrl.origin` 은
 * 내부 바인딩(http://127.0.0.1:3010)으로 잡힐 수 있고, 플러그인은 **manifest 와 같은 https origin 의 파일만** 받는다(task-003f C1-3).
 * 개발 서버는 요청 origin(localhost 스모크가 운영 파일을 가리키지 않게). 값은 매 호출 때 읽는다(pm2 --update-env 반영).
 */
export function publicOrigin(requestOrigin: string): string {
  if (process.env.NODE_ENV === 'production') {
    const raw = process.env.OAUTH_CALLBACK_BASE?.trim()
    if (raw) {
      try {
        const u = new URL(raw)
        if (u.protocol === 'https:' && !u.username && !u.password) return u.origin
      } catch {
        // 아래 경고로 수렴
      }
    }
    console.warn('[origin] OAUTH_CALLBACK_BASE 가 https 공개 주소가 아니라 요청 origin 을 씁니다')
  }
  return new URL(requestOrigin).origin
}
