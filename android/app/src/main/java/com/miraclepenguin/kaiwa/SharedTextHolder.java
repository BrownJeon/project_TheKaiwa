package com.miraclepenguin.kaiwa;

import android.content.Intent;

/**
 * 다른 앱이 「공유」로 보낸 글 한 건을 웹이 꺼내 갈 때까지 들고 있는 메모리 보관함(task-052).
 *
 * <p>디스크·SharedPreferences·로그에 쓰지 않는다 — 카톡 대화 같은 개인 글이라 프로세스와 함께 사라지는 편이 맞다(그때는 다시
 * 공유하면 된다). 웹은 브리지로 한 번만 꺼내고({@link #take}) 꺼내면 비운다. 새 공유가 오면 이전 것을 덮는다(마지막 공유가 사용자 뜻).
 *
 * <p>상한은 코드포인트 기준 앞 {@value #MAX_CODE_POINTS}자 — 붙여넣기 화면 상한(2,000자)보다 넉넉히 받아 화면이 [자르기]를
 * 보여 줄 수 있게 하되, 수십만 자가 WebView 로 넘어가지 않게. TTL {@link #TTL_MS} 는 로그인 왕복(Custom Tab)을 견디는 길이.
 * 시계는 주입한다(앱은 기기가 잠든 시간도 세는 {@code SystemClock.elapsedRealtime}, 시험은 가짜 시계).
 *
 * <p>{@link Shared} 는 {@code toString} 을 덮지 않는다 — 실수로 로그에 찍혀도 본문이 나가지 않게.
 */
final class SharedTextHolder {

    static final int MAX_CODE_POINTS = 10_000;
    static final long TTL_MS = 30L * 60L * 1000L;

    interface Clock {
        long nowMs();
    }

    static final class Shared {

        final String text;
        final boolean truncated;

        Shared(String text, boolean truncated) {
            this.text = text;
            this.truncated = truncated;
        }
    }

    private final Clock clock;
    private Shared held;
    private long heldAt;

    SharedTextHolder(Clock clock) {
        this.clock = clock;
    }

    /**
     * 글이 없는 공유(EXTRA_TEXT 없음·문자열 아님 = {@code null})와 공백뿐인 글도 버리지 않고 빈 글로 보관한다 — 「공유가 도착했다」는
     * 사실이 있어야 웹이 붙여넣기 화면을 열고 「글을 받지 못했어요」를 보일 수 있다(데모 D5-A, Leader 계약 보완 2026-10-11).
     */
    synchronized void put(CharSequence raw) {
        String text = raw == null || isBlank(raw) ? "" : raw.toString();
        boolean truncated = false;
        if (text.length() > MAX_CODE_POINTS && text.codePointCount(0, text.length()) > MAX_CODE_POINTS) {
            text = text.substring(0, text.offsetByCodePoints(0, MAX_CODE_POINTS));
            truncated = true;
        }
        held = new Shared(text, truncated);
        heldAt = clock.nowMs();
    }

    synchronized boolean has() {
        dropIfExpired();
        return held != null;
    }

    /** 한 번만 돌려주고 비운다. 없거나 만료면 {@code null}. */
    synchronized Shared take() {
        dropIfExpired();
        Shared s = held;
        held = null;
        return s;
    }

    /** 공백 판정 — {@code String.isBlank} 는 minSdk 에서 못 쓴다. 전각 공백(U+3000)·NBSP 도 공백으로 본다. */
    static boolean isBlank(CharSequence s) {
        for (int i = 0; i < s.length(); ) {
            int cp = Character.codePointAt(s, i);
            if (!Character.isWhitespace(cp) && !Character.isSpaceChar(cp)) {
                return false;
            }
            i += Character.charCount(cp);
        }
        return true;
    }

    private void dropIfExpired() {
        if (held == null) {
            return;
        }
        long age = clock.nowMs() - heldAt;
        if (age < 0 || age > TTL_MS) {
            held = null;
        }
    }

    /**
     * 받을 공유인가 — 글({@code text/plain}) {@code ACTION_SEND} 이고, 최근 앱 목록에서 다시 연 것(시스템이 처음 인텐트를 되살려 줌)도
     * 프로세스 복구({@code restoring})도 아닐 때만. 둘 다 이미 지나간 공유를 다시 넣는 경로다.
     */
    static boolean isFreshTextShare(String action, String mimeType, int flags, boolean restoring) {
        return Intent.ACTION_SEND.equals(action)
            && isPlainText(mimeType)
            && !restoring
            && (flags & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0;
    }

    static boolean isPlainText(String mimeType) {
        if (mimeType == null) {
            return false;
        }
        int semi = mimeType.indexOf(';');
        String base = (semi >= 0 ? mimeType.substring(0, semi) : mimeType).trim();
        return "text/plain".equalsIgnoreCase(base);
    }
}
