# nginx vhost (Phase 0 에서 작성)

`kaiwa.xn--lh0b87pnudm10a4vd.com.conf` — TheMeal `docs/nginx/*.conf` 를 기반으로:
- `/` → `127.0.0.1:3010` (proxy_read_timeout 600s, SSE 를 위해 `proxy_buffering off`)
- `/ws/speech` → `127.0.0.1:8100` — `climb.*` vhost 의 WebSocket 블록(`Upgrade`/`Connection "upgrade"`) 복사. `voice.*` 의 `Connection ""` 은 쓰지 않는다
- `/app/download/` → `DATA_ROOT/releases/`(APK 배포본, `latest.apk` 심볼릭 링크)
- `/models/` → 앱 라우트(또는 정적) — ReazonSpeech int8 모델 서빙(≈160MB, `Cache-Control` 장기)
적용은 사용자 sudo(`OPS-QUEUE` #4).
