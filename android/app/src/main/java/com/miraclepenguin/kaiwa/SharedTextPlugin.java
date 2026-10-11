package com.miraclepenguin.kaiwa;

import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 공유받은 글을 웹에 넘기는 앱 내장 플러그인(task-052). JS 이름 {@code SharedText} — 웹에서는
 * {@code src/modules/infra/native/sharedText.ts} 만 부른다.
 *
 * <pre>
 *   peek()            → { available }        들고 있는 글이 있는가만(본문 없음)
 *   consume()         → { text, truncated }  한 번만 주고 비운다 · 없거나 만료면 {}
 *   이벤트 sharedText → {}                   앱이 떠 있는 채 새 공유가 왔다는 신호만(본문은 consume 으로)
 * </pre>
 *
 * npm 패키지가 아니라 {@link MainActivity} 가 {@code registerPlugin} 으로 등록한다 — cap sync·capacitor.plugins.json 에는 나오지 않는다.
 * 본문은 resolve 값으로만 나간다. reject 하지 않는다(Capacitor 는 오류 응답의 data 를 debug 로그에 찍는다).
 */
@CapacitorPlugin(name = "SharedText")
public class SharedTextPlugin extends Plugin {

    static final String EVENT_ARRIVED = "sharedText";
    static final SharedTextHolder HOLDER = new SharedTextHolder(SystemClock::elapsedRealtime);

    @PluginMethod
    public void peek(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", HOLDER.has());
        call.resolve(ret);
    }

    @PluginMethod
    public void consume(PluginCall call) {
        SharedTextHolder.Shared shared = HOLDER.take();
        JSObject ret = new JSObject();
        if (shared != null) {
            ret.put("text", shared.text);
            ret.put("truncated", shared.truncated);
        }
        call.resolve(ret);
    }

    void notifyArrived() {
        notifyListeners(EVENT_ARRIVED, new JSObject());
    }
}
