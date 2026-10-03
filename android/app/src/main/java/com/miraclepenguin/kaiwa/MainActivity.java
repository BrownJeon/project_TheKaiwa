package com.miraclepenguin.kaiwa;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * TheKaiwa 앱 셸 — 운영 웹을 WebView 로 띄운다(설계안 §12). 여기에는 웹으로 고칠 수 없는 세 가지만 둔다.
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
 * <h2>3. 키보드가 열리면 WebView 를 키보드 위까지로 줄인다(task-021, IMP-0008)</h2>
 * Android 15(targetSdk 35)는 edge-to-edge 가 강제돼 매니페스트 {@code adjustResize} 가 창을 줄이지 않는다. Capacitor 7.6.9
 * {@code CapacitorWebView.edgeToEdgeHandler}({@code adjustMarginsForEdgeToEdge:'auto'})는 WebView margin 을
 * {@code systemBars|displayCutout} 만으로 주고 {@code CONSUMED} 를 돌려줘 키보드(IME) 높이가 WebView 에 가지 않는다 →
 * 키보드가 떠도 {@code innerHeight}·{@code visualViewport} 가 그대로라 웹 {@code KeyboardInset} 이 키보드를 알 수 없다
 * (앱 1.0.1 회화방 글자 모드 재현). 그래서 Capacitor 가 {@code super.onCreate} 안에서 건 리스너를 <b>같은 계산 + 키보드</b>로
 * 교체한다(뷰당 리스너는 하나라 교체이지 중복이 아니다): 하단 margin = max(내비게이션 바, 키보드) — IME 인셋은 화면 아래 끝부터
 * 재므로 내비게이션 바를 이미 포함한다(합이 아니라 max). 키보드가 닫히면 ime = 0 이라 내비게이션 바만큼으로 돌아간다.
 * WebView 가 실제로 줄어 웹은 "창이 줄어드는" 경로로 전 화면이 같이 동작한다. bjj {@code MainActivity} 와 같은 방식(2026-09-14 실기기).
 * API 34 이하는 edge-to-edge 강제가 아니고 {@code adjustResize} 가 창을 줄이므로 손대지 않는다(키보드 margin 까지 주면 이중).
 * 전제: capacitor.config.ts {@code adjustMarginsForEdgeToEdge:'auto'} 이고 테마에 {@code windowOptOutEdgeToEdgeEnforcement} 가
 * 없다 — 둘 중 하나를 바꾸면 Capacitor 가 margin 을 안 주는데 여기서는 주게 되므로 이 조건도 같이 맞춘다.
 *
 * <p><b>이 파일을 바꾸면 네이티브 변경</b>이다 — 웹 배포로는 반영되지 않고 APK 재빌드·versionCode 증가가 필요하다.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> openInBrowser(url));
            fitAboveKeyboard(bridge.getWebView());
        }
    }

    private static void fitAboveKeyboard(WebView webView) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            return;
        }
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(mlp);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
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
