---
task_id: task-063
title: "공유 NAS MariaDB 쓰기 지연 — 설정 점검·조정안 (HOME-SERVER 영역, 사용자 승인 2026-10-12, 적용은 관리자 권한 필요)"
status: blocked
base_ref: b89d779
risk_level: "R2"
roles_involved: [leader]
related_tasks: [task-057-perf-today-words-set-creation]
tags:
  - type/task
  - domain/infra
aliases:
  - NAS DB 쓰기 설정
  - task-063
created: 2026-10-12
updated: 2026-10-12
---

# task-063 — NAS MariaDB 쓰기 설정

## 사용자 요청 (원문)
- 2026-10-12 「D. NAS DB쓰기설정에 대해서 승인할테니 작업 진행해줘.」 + 「작성안 요구안대로 진행해주고 결과알려줘」. 근거 이력: [[task-057-perf-today-words-set-creation]] — 오늘의 단어 세트 생성 지연(p50 ≈2.6초)의 70~75% 가 쓰기 트랜잭션의 COMMIT 대기, 같은 쓰기 지연이 다른 쓰기 엔드포인트에도 붙을 것(`[가능성 높음]`).

## 상태: 적용하지 못함(막힘) — 이유
이 앱의 DB 계정 `thekaiwa`@`%` 는 **`thekaiwa` 스키마 한정 권한**(`GRANT ALL PRIVILEGES ON thekaiwa.*`)뿐이라 `SET GLOBAL`(SUPER/SYSTEM VARIABLES ADMIN 필요)을 할 수 없고, 서버 설정 파일은 NAS(Synology DSM, 192.168.219.154)의 MariaDB10 패키지 안에 있다. 이 환경에는 NAS 관리자 접근 수단(별도 SSH 호스트 설정·DB root 자격)이 **구성돼 있지 않다**(`~/.ssh/config` 에 NAS 항목 없음). 권한을 우회해 찾지 않았다. → 사용자가 아래 문장을 NAS 에서 실행하거나, 접근 수단을 정해 주면 이어서 검증한다.

## 실측 (2026-10-12, 읽기 전용 + 임시 표 20회 INSERT·삭제)
- 서버: **MariaDB 10.11.11**(Synology `/var/packages/MariaDB10`), 가동 4,153,533초(약 48일).
- 현재 값: `innodb_buffer_pool_size`=**16,777,216(16 MiB)** · `innodb_flush_log_at_trx_commit`=**1** · `sync_binlog`=**1** · `log_bin`=ON(ROW, 보관 30일) · `innodb_flush_method`=fsync · `innodb_doublewrite`=ON · `innodb_io_capacity`=200 · `innodb_log_file_size`=96 MiB · `max_connections`=151.
- 상태: 버퍼풀 페이지 1005개 중 데이터 213, 읽기 요청 427,970,883 대비 디스크 읽기 26,398,033 = **미스 약 6.2%**(적중 93.8%), `Innodb_log_waits`=0, 연결 34개.
- **COMMIT 지연(INSERT+COMMIT n=20)**: p50 **418ms** · p90 945ms · max 1,336ms · min 79ms. 같은 연결의 `SELECT 1` 왕복은 p50 0.5ms → **네트워크가 아니라 디스크 쓰기(fsync) 경로**가 느리다 `[확실]`(측정 사실) / 원인이 HDD·다른 부하인지는 `[추측]`.
- `thekaiwa` 스키마 크기 8.3 MB. 같은 서버를 다른 프로젝트도 쓰므로 버퍼풀이 16MB 면 공유 작업 집합이 거의 못 들어간다 `[가능성 높음]`.

## 조정안 (사용자 판단이 필요한 내구성 교환 포함)
| 설정 | 현재 | 제안 | 효과 | 위험·교환 |
|---|---|---|---|---|
| `innodb_buffer_pool_size` | 16 MiB | **256 MiB**(NAS 여유 RAM 의 25~50% 범위에서 — RAM 확인 후) | 디스크 읽기 6.2% 미스 감소 → 쓰기와 경쟁하는 I/O 감소 | 메모리 사용 증가. 10.11 은 런타임 변경 가능. |
| `innodb_flush_log_at_trx_commit` | 1 | **2** | COMMIT 마다 redo fsync 대신 초당 1회 → COMMIT 대기 대폭 감소 | **MariaDB 프로세스만 죽으면 손실 0**, NAS 전원 차단·커널 패닉이면 **최근 약 1초의 커밋을 잃을 수 있음** |
| `sync_binlog` | 1 | **0**(바이너리 로그를 백업/복제에 쓰면 100) | COMMIT 마다 binlog fsync 제거 | 크래시 시 binlog 꼬리 손실. binlog 용도(Hyper Backup/복제 여부)를 NAS 에서 확인 후 결정 |
- 예상 효과 `[추측]`: COMMIT p50 418ms → 수 ms~수십 ms. **적용 전후를 같은 프로브로 재서 확인**(아래).
- 적용 순서(모두 런타임 `SET GLOBAL` 로 즉시 적용·즉시 되돌림 가능): 버퍼풀 → `flush_log_at_trx_commit` → `sync_binlog`, 단계마다 프로브.

## 사용자가 NAS 에서 실행할 문장 (관리자 DB 계정)
```sql
-- 0) 되돌리기용 현재 값 기록
SELECT @@innodb_buffer_pool_size, @@innodb_flush_log_at_trx_commit, @@sync_binlog;
-- 1) 즉시 적용(재시작 없음)
SET GLOBAL innodb_buffer_pool_size = 268435456;   -- 256MiB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
SET GLOBAL sync_binlog = 0;                        -- binlog 를 백업/복제에 쓰면 100
-- 되돌리기
SET GLOBAL innodb_flush_log_at_trx_commit = 1;
SET GLOBAL sync_binlog = 1;
SET GLOBAL innodb_buffer_pool_size = 16777216;
```
- **영구 적용**: `SET GLOBAL` 은 MariaDB 재시작 시 사라진다. NAS 의 MariaDB 설정 파일 `[mysqld]` 절에 같은 세 값을 넣어야 한다. Synology 패키지의 설정 파일 위치는 NAS 에서 `ps aux | grep mysqld` 로 `--defaults-file` 를 찾아 확인(경로를 추측하지 않는다). DSM/패키지 업데이트로 덮어써질 수 있으니 재부팅 뒤 `SELECT @@…` 로 재확인.
- 전 프로젝트에 영향하므로 적용 시각을 알리고, 이상하면 위 되돌리기 문장.

## 적용 전후 비교용 프로브 (현재 값 p50 418ms 와 비교)
`thekaiwa` 스키마에 임시 표 `_zz_commit_probe` 를 만들어 20번 `INSERT`+`COMMIT` 한 뒤 지운다(앱 계정으로 실행 가능). 우분투에서: `cd ~/.node-local/thekaiwa && NODE_PATH=$PWD/node_modules node --env-file=<TheKaiwa>/.env <프로브.cjs>` — 프로브 소스는 아래.
```js
const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); const N = Number(process.env.N || 20)
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))]
;(async () => {
  await p.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS `_zz_commit_probe` (id INT AUTO_INCREMENT PRIMARY KEY, v VARCHAR(32)) ENGINE=InnoDB')
  const ms = []
  try {
    for (let i = 0; i < N; i++) { const t0 = process.hrtime.bigint(); await p.$transaction(async (tx) => { await tx.$executeRawUnsafe("INSERT INTO `_zz_commit_probe` (v) VALUES ('x')") }); ms.push(Number(process.hrtime.bigint() - t0) / 1e6) }
    console.log(`INSERT+COMMIT n=${N}: p50=${pct(ms, 0.5).toFixed(0)}ms p90=${pct(ms, 0.9).toFixed(0)}ms max=${Math.max(...ms).toFixed(0)}ms`)
  } finally { await p.$executeRawUnsafe('DROP TABLE IF EXISTS `_zz_commit_probe`'); await p.$disconnect() }
})()
```

## 다음
- 사용자: 위 SQL 실행(또는 NAS 접근 수단 지정) → Leader 가 프로브로 전후 비교·앱 영향(오늘의 단어 세트 생성 p50 등) 재측정·기록. 영구 설정 파일 위치와 NAS RAM 은 NAS 에서 확인.
- HOME-SERVER_CONFIG 문서 반영은 그 프로젝트 영역 — 사용자 지시 시.

## 상태 로그
- 2026-10-12 접수·실측·조정안 작성. 적용은 권한 때문에 **막힘**(위 사유).
