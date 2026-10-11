package com.miraclepenguin.kaiwa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Intent;

import org.junit.Test;

/** task-052 — 공유 글 보관함: 1회 소비·코드포인트 상한·TTL·받을 Intent 판정. Android 런타임 없이 도는 순수 Java 시험. */
public class SharedTextHolderTest {

    private static final class FakeClock implements SharedTextHolder.Clock {
        long now = 1_000_000L;

        @Override
        public long nowMs() {
            return now;
        }
    }

    private static String repeat(String unit, int times) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < times; i++) {
            sb.append(unit);
        }
        return sb.toString();
    }

    @Test
    public void take_returnsOnce_thenEmpty() {
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        assertFalse(h.has());
        assertNull(h.take());
        h.put("こんにちは、今日の表現です。");
        assertTrue(h.has());
        assertTrue("peek 은 비우지 않는다", h.has());
        SharedTextHolder.Shared s = h.take();
        assertNotNull(s);
        assertEquals("こんにちは、今日の表現です。", s.text);
        assertFalse(s.truncated);
        assertFalse(h.has());
        assertNull("두 번째 take 는 null", h.take());
    }

    @Test
    public void put_replacesPrevious() {
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        h.put("first");
        h.put("second");
        assertEquals("second", h.take().text);
        assertNull(h.take());
    }

    @Test
    public void emptyNullOrBlank_isKeptAsEmptyShare_once() {
        // 빈 공유도 「도착함」으로 보관(D5): has true → take {"" , false} → 두 번째 take null.
        CharSequence[] blanks = {null, "", "   ", " \n\t ", "　 "};
        for (CharSequence raw : blanks) {
            SharedTextHolder h = new SharedTextHolder(new FakeClock());
            h.put(raw);
            assertTrue("has: " + (raw == null ? "null" : raw.length()), h.has());
            SharedTextHolder.Shared s = h.take();
            assertNotNull(s);
            assertEquals("", s.text);
            assertFalse(s.truncated);
            assertNull(h.take());
            assertFalse(h.has());
        }
    }

    @Test
    public void textWithSurroundingSpaces_isKeptAsIs() {
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        h.put("  おはよう  ");
        assertEquals("  おはよう  ", h.take().text);
    }

    @Test
    public void cap_exactLimit_notTruncated() {
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        h.put(repeat("あ", SharedTextHolder.MAX_CODE_POINTS));
        SharedTextHolder.Shared s = h.take();
        assertEquals(SharedTextHolder.MAX_CODE_POINTS, s.text.length());
        assertFalse(s.truncated);
    }

    @Test
    public void cap_overLimit_truncatedToFirstCodePoints() {
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        h.put(repeat("あ", SharedTextHolder.MAX_CODE_POINTS + 5));
        SharedTextHolder.Shared s = h.take();
        assertEquals(SharedTextHolder.MAX_CODE_POINTS, s.text.length());
        assertTrue(s.truncated);
    }

    @Test
    public void cap_countsCodePoints_neverSplitsSurrogatePair() {
        // 😀 는 UTF-16 두 칸. 10,000 코드포인트 = 20,000 char 는 자르지 않고, 10,001 이면 앞 10,000 개(쌍 그대로)만.
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        String emoji = new String(Character.toChars(0x1F600));
        h.put(repeat(emoji, SharedTextHolder.MAX_CODE_POINTS));
        SharedTextHolder.Shared exact = h.take();
        assertFalse(exact.truncated);
        assertEquals(SharedTextHolder.MAX_CODE_POINTS * 2, exact.text.length());

        h.put("a" + repeat(emoji, SharedTextHolder.MAX_CODE_POINTS));
        SharedTextHolder.Shared over = h.take();
        assertTrue(over.truncated);
        assertEquals(SharedTextHolder.MAX_CODE_POINTS, over.text.codePointCount(0, over.text.length()));
        assertFalse("끝이 반쪽 서로게이트가 아니다", Character.isHighSurrogate(over.text.charAt(over.text.length() - 1)));
    }

    @Test
    public void ttl_keepsUntil30Minutes_thenExpires() {
        FakeClock clock = new FakeClock();
        SharedTextHolder h = new SharedTextHolder(clock);
        h.put("hello");
        clock.now += SharedTextHolder.TTL_MS;
        assertTrue("정확히 30분은 아직 유효", h.has());
        clock.now += 1;
        assertFalse(h.has());
        assertNull(h.take());
    }

    @Test
    public void ttl_expiredTake_isNull_andClockGoingBackIsExpired() {
        FakeClock clock = new FakeClock();
        SharedTextHolder h = new SharedTextHolder(clock);
        h.put("hello");
        clock.now += SharedTextHolder.TTL_MS + 1;
        assertNull(h.take());

        h.put("again");
        clock.now -= 1;
        assertFalse("시계가 거꾸로 가면 버린다", h.has());
    }

    @Test
    public void shared_toString_doesNotLeakText() {
        SharedTextHolder h = new SharedTextHolder(new FakeClock());
        h.put("ひみつのメッセージ");
        SharedTextHolder.Shared s = h.take();
        assertFalse(String.valueOf(s).contains("ひみつ"));
    }

    @Test
    public void isPlainText() {
        assertTrue(SharedTextHolder.isPlainText("text/plain"));
        assertTrue(SharedTextHolder.isPlainText("TEXT/PLAIN; charset=utf-8"));
        assertFalse(SharedTextHolder.isPlainText(null));
        assertFalse(SharedTextHolder.isPlainText("text/html"));
        assertFalse(SharedTextHolder.isPlainText("image/png"));
        assertFalse(SharedTextHolder.isPlainText("text/plainx"));
    }

    @Test
    public void isFreshTextShare() {
        assertTrue(SharedTextHolder.isFreshTextShare(Intent.ACTION_SEND, "text/plain", 0, false));
        assertFalse("프로세스 복구", SharedTextHolder.isFreshTextShare(Intent.ACTION_SEND, "text/plain", 0, true));
        assertFalse("최근 앱 목록에서 다시 열기",
            SharedTextHolder.isFreshTextShare(Intent.ACTION_SEND, "text/plain", Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY, false));
        assertFalse(SharedTextHolder.isFreshTextShare(Intent.ACTION_SEND_MULTIPLE, "text/plain", 0, false));
        assertFalse(SharedTextHolder.isFreshTextShare(Intent.ACTION_VIEW, "text/plain", 0, false));
        assertFalse(SharedTextHolder.isFreshTextShare(Intent.ACTION_SEND, "image/jpeg", 0, false));
        assertFalse(SharedTextHolder.isFreshTextShare(null, null, 0, false));
    }
}
