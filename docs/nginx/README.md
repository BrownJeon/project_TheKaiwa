# nginx vhost — kaiwa.xn--lh0b87pnudm10a4vd.com

우분투 `home-dev-x600` 의 nginx 는 `sites-available/*.conf` + `sites-enabled/` 심볼릭 링크 구조이고 root 소유라 **사용자가 sudo 로 적용**한다(Leader 는 파일만 준비). DNS·TLS 는 와일드카드(`*.xn--lh0b87pnudm10a4vd.com`)라 손댈 것 없음.

```bash
sudo cp /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa/docs/nginx/kaiwa.xn--lh0b87pnudm10a4vd.com.conf /etc/nginx/sites-available/ \
 && sudo ln -sfn /etc/nginx/sites-available/kaiwa.xn--lh0b87pnudm10a4vd.com.conf /etc/nginx/sites-enabled/kaiwa.xn--lh0b87pnudm10a4vd.com.conf \
 && sudo nginx -t && sudo systemctl reload nginx
```

확인(앱 기동 전엔 502 가 정상 — vhost 가 붙었다는 뜻):
```bash
curl -sI https://kaiwa.xn--lh0b87pnudm10a4vd.com/ | head -3
```

- `/` → Next.js `127.0.0.1:3010`(pm2 `thekaiwa`, blue/green 은 `scripts/deploy.sh` 가 포트 스위칭) · SSE 위해 `proxy_buffering off`
- `/ws/speech` → `127.0.0.1:8100`(speech gateway, task-003) · `Upgrade` 헤더(climb vhost 패턴; voice vhost 의 `Connection ""` 은 WS 에 쓰지 않음)
- `/app/download/` → `DATA_ROOT/releases/`(APK, task-009) · `/models/` → 앱 라우트(모델 다운로드 900s)
- modsecurity 규칙 id **9001010**(2026-09-26 스캔: 9001001~9001009 사용 중). 다른 vhost 와 겹치면 `nginx -t` 는 통과해도 modsecurity 가 기동 거부하니 새 vhost 추가 시 재스캔.
- 본문 상한 32m: 발화 wav(≤2MB)·사진 없음. Voice Package zip(Phase 4) 때 512m 로 상향.
