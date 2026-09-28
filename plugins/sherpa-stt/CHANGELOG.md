# @thekaiwa/sherpa-stt — 변경 기록

버전이 바뀌면(이 디렉터리·AAR·manifest `minPluginVersion` 영향) **네이티브 변경**이다 — `android/app/build.gradle` versionCode 증가 + APK 재빌드·재설치(README §8).

## 0.1.0 — 2026-09-28 (task-003f, APK versionCode 1)

### Codex C2 High 보강 (첫 APK 배포 전이라 같은 0.1.0 / versionCode 1)
- 다운로드 commit(rename + 옛 버전 삭제) ↔ 세션의 인식기 로드 경합 제거: `ModelGate` 에 **모델 파일 잠금**을 두고 commit·deleteModel 삭제·verify 삭제와 VAD 생성·인식기 로드·preload 를 배타로. 파일 전송은 잠그지 않아 받는 동안 회화는 그대로 된다. 게이트 모니터와 따로 둔 잠금이라 로드 1~2초 동안 `handleOnPause`·`stop` 의 세션 조회가 멈추지 않는다(잠금 순서 게이트 → 파일).
- 세션 `modelVersion` 은 로드가 실제로 올린 버전으로 고친다(`SessionLoad.kt`) — final 의 `modelVersion` = 인식기 버전. 세션 중 `preload` 는 `BUSY`(인식기를 바꾸지 않음).
- manifest: 같은 키 두 번(이스케이프를 푼 키 포함)·뒤따르는 내용 거절(org.json 구현마다 다르던 판정을 원문 검사로 고정). 공용 픽스처 +6(중복 키·`16000.0`·`643854.0`·뒤따르는 내용·압축 원문) = 59 사례.
- 확인: 로드 뒤 모델 파일을 지워도 인식 정상(desktop-check DELETE-AFTER-LOAD, 매핑·핸들 0). JVM 테스트 67.

### REV-021 보강 (첫 APK 배포 전이라 같은 0.1.0 / versionCode 1)
- `deleteModel` ↔ `start` TOCTOU 제거: 세션·다운로드·삭제 점유를 `ModelGate` 한 임계구역에서 판정·점유. 삭제가 끝날 때까지 `start`·`downloadModel` 은 `BUSY`(오류 코드 집합은 그대로 — 계약 v1.1 동작 보강). 세션의 인식기 로드는 실행 시점의 설치본을 다시 읽는다.
- manifest 규칙을 서버와 맞춤: sha256 **소문자만**(대문자 거절), `name` 대문자 허용·`..` 금지, `version` 에 `..` 금지. 공용 픽스처 `test-fixtures/manifest-cases.json`(53 사례)을 JVM 테스트가 읽는다 — 서버 TS 테스트도 같은 파일을 읽는다.
- README §6·§7 을 실제 #19 모양(불투명 `/models/ondevice-ja-v1/*`, 콘솔 Apply 없음)과 웹 라우터 규칙으로 고침.

### 첫 구현

- 첫 구현. Kotlin · Capacitor 7 · sherpa-onnx **1.13.8** GitHub 릴리스 AAR(sha256 `633c2432…bd96`, gateway `sherpa-onnx==1.13.8` 과 같음) · `arm64-v8a` 만.
- 인식: silero VAD 구간 → 앞 0.2s·뒤 0.3s 여유 → 앞 0.4s·뒤 0.2s 0 패딩 → zipformer transducer int8 오프라인 디코드(gateway `reazon_sherpa.py` 와 같은 값). `manual`(푸시투토크)·`auto`(끝점) 두 방식, final 1회·순서 보장.
- 모델: 같은 origin https manifest 엄격 검증·파일별 Range 이어받기·sha256·원자적 설치·다운그레이드 거부·Wi-Fi(비과금) 기본.
- JS 계약 v1.1(task-003f 이력서): 메서드 14개·이벤트 6종·오류 코드 21개. 엔진·모델·파일 이름은 JS 로 보내지 않는다.
- 검증: JVM 단위 테스트 51개(`scripts/build-apk.sh --test`), 데스크톱 점검 stt20 20/20(`tools/desktop-check/run.sh`). 실기기(S25+) 디코드 시간·RSS·다운로드 재개는 F6.
