# nginx vhost — kaiwa.xn--lh0b87pnudm10a4vd.com

우분투 `home-dev-x600` 의 nginx 는 `sites-available/*.conf` + `sites-enabled/` 심볼릭 링크 구조이고 root 소유라 **사용자가 sudo 로 적용**한다(Leader 는 파일만 준비). DNS·TLS 는 와일드카드(`*.xn--lh0b87pnudm10a4vd.com`)라 손댈 것 없음.

```bash
sudo cp /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa/docs/nginx/kaiwa.xn--lh0b87pnudm10a4vd.com.conf /etc/nginx/sites-available/ \
 && sudo ln -sfn /etc/nginx/sites-available/kaiwa.xn--lh0b87pnudm10a4vd.com.conf /etc/nginx/sites-enabled/kaiwa.xn--lh0b87pnudm10a4vd.com.conf \
 && sudo nginx -t && sudo systemctl reload nginx
```

적용 이력: 2026-09-26 23:07 사용자 적용(`nginx -t` 통과, `/`·`/ws/speech` 502 = 업스트림 미기동 정상).

확인(앱 기동 전엔 502 가 정상 — vhost 가 붙었다는 뜻):
```bash
curl -sI https://kaiwa.xn--lh0b87pnudm10a4vd.com/ | head -3
```

- `/` → Next.js `127.0.0.1:3010`(pm2 `thekaiwa`, blue/green 은 `scripts/deploy.sh` 가 포트 스위칭) · SSE 위해 `proxy_buffering off`
- `/ws/speech` → `127.0.0.1:8100`(speech gateway, task-003) · `Upgrade` 헤더(climb vhost 패턴; voice vhost 의 `Connection ""` 은 WS 에 쓰지 않음)
- `/app/download/` → **앱 라우트로 프록시**(APK 는 Next.js `GET /app/download/[file]` 이 `DATA_ROOT/releases/` 에서 스트리밍, task-009). 처음 적용본(2026-09-26 23:07)은 nginx `alias` 였는데 www-data 가 `/home/brownjeon`(750) 을 못 지나 403 → 프록시로 수정. **task-009 전에 같은 명령으로 재적용** · `/models/` → 앱 라우트(모델 다운로드 900s)
- modsecurity 규칙 id **9001010**(2026-09-26 스캔: 9001001~9001009 사용 중). 다른 vhost 와 겹치면 `nginx -t` 는 통과해도 modsecurity 가 기동 거부하니 새 vhost 추가 시 재스캔.
- 본문 상한 32m: 발화 wav(≤2MB)·사진 없음. Voice Package zip(Phase 4) 때 512m 로 상향.
