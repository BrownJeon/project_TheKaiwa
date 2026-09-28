package com.miraclepenguin.kaiwa;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;

import com.getcapacitor.BridgeActivity;

/**
 * TheKaiwa 앱 셸 — 운영 웹을 WebView 로 띄운다(설계안 §12). 여기에는 웹으로 고칠 수 없는 두 가지만 둔다.
 *
 * <h2>1. 로그인 유지 — onPause 에서 쿠키를 디스크로</h2>
 * WebView 의 {@link CookieManager} 는 쿠키를 메모리에 들고 있다가 비정기적으로만 내려쓴다. 그 전에 프로세스가 죽으면
 * 서버가 {@code Set-Cookie} 로 준 30일 세션이 사라져 매번 로그인 화면으로 돌아온다. Capacitor 는 JS {@code CapacitorCookies}
 * 경로에서만 flush 하고 BridgeActivity 의 onPause/onStop 은 쿠키를 건드리지 않는다(VoiceVault 2026-09-19 실기기,
 * app-conversion-guide §1-1). onPause 는 홈·앱 전환·종료 어느 경로에서도 먼저 불린다.
 *
 * <h2>2. 파일 다운로드는 시스템 브라우저로</h2>
 * WebView 는 {@code Content-Disposition: attachment} 응답(예: {@code /app/download/latest.apk})을 스스로 처리하지 못해
 * 링크를 눌러도 아무 일도 일어나지 않는다. 화면은 Custom Tabs 로 여는 것이 기본이고(docs/screens.md §11-0 ⑩),
 * 이것은 WebView 안에서 눌렸을 때의 예비 길이다 — https 주소만 넘긴다.
 *
 * <p>외부 호스트 탐색은 Capacitor {@code Bridge.launchIntent} 가 이미 시스템 브라우저로 넘긴다
 * ({@code server.allowNavigation} 비움 — capacitor.config.ts 주석, task-003f C1-4).
 *
 * <p><b>이 파일을 바꾸면 네이티브 변경</b>이다 — 웹 배포로는 반영되지 않고 APK 재빌드·versionCode 증가가 필요하다.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> openInBrowser(url));
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    private void openInBrowser(String url) {
        Uri uri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException e) {
            // 브라우저가 없는 기기 — 할 수 있는 일이 없다.
        }
    }
}
