# @thekaiwa/sherpa-stt — 변경 기록

버전이 바뀌면(이 디렉터리·AAR·manifest `minPluginVersion` 영향) **네이티브 변경**이다 — `android/app/build.gradle` versionCode 증가 + APK 재빌드·재설치(README §8).

## 0.1.0 — 2026-09-28 (task-003f, APK versionCode 1)

- 첫 구현. Kotlin · Capacitor 7 · sherpa-onnx **1.13.8** GitHub 릴리스 AAR(sha256 `633c2432…bd96`, gateway `sherpa-onnx==1.13.8` 과 같음) · `arm64-v8a` 만.
- 인식: silero VAD 구간 → 앞 0.2s·뒤 0.3s 여유 → 앞 0.4s·뒤 0.2s 0 패딩 → zipformer transducer int8 오프라인 디코드(gateway `reazon_sherpa.py` 와 같은 값). `manual`(푸시투토크)·`auto`(끝점) 두 방식, final 1회·순서 보장.
- 모델: 같은 origin https manifest 엄격 검증·파일별 Range 이어받기·sha256·원자적 설치·다운그레이드 거부·Wi-Fi(비과금) 기본.
- JS 계약 v1.1(task-003f 이력서): 메서드 14개·이벤트 6종·오류 코드 21개. 엔진·모델·파일 이름은 JS 로 보내지 않는다.
- 검증: JVM 단위 테스트 51개(`scripts/build-apk.sh --test`), 데스크톱 점검 stt20 20/20(`tools/desktop-check/run.sh`). 실기기(S25+) 디코드 시간·RSS·다운로드 재개는 F6.
