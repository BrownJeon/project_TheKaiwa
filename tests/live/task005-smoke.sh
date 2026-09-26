#!/usr/bin/env bash
# task-005 API 스모크 — 우분투에서 QA 테스트 계정 세션으로 127.0.0.1:3010 을 친다(qa-session.ts 먼저).
# 사용: bash tests/live/task005-smoke.sh [/tmp/kaiwa-qa-cookie]
set -u
C="Cookie: $(cat "${1:-/tmp/kaiwa-qa-cookie}")"; B=http://127.0.0.1:3010
j(){ curl -s -m 20 -H "$C" -H "Content-Type: application/json" "$@"; echo; }
echo "1 GET profile";          j $B/api/v1/settings/profile
echo "2 PUT profile";          j -X PUT $B/api/v1/settings/profile -d '{"teacherName":"유우","level":"N5"}'
echo "3 PUT 금지 키(400)";      j -X PUT $B/api/v1/settings/profile -d '{"speed":1}'
echo "4 GET voices";           j $B/api/v1/voices
echo "5 GET voice(name 포함)";  j $B/api/v1/settings/voice
echo "6 PUT voice";            j -X PUT $B/api/v1/settings/voice -d '{"voiceProfileId":"teacher_sakura","style":"Happy","styleWeight":null,"speed":0.9,"pitch":1,"intonation":1.1,"speechProfile":"LEARNING_SLOW"}'
echo "7 speed 1.5(400)";       j -X PUT $B/api/v1/settings/voice -d '{"voiceProfileId":"teacher_sakura","style":"AUTO","speed":1.5,"pitch":1,"intonation":1,"speechProfile":"NATIVE"}'
echo "8 없는 목소리(400)";      j -X PUT $B/api/v1/settings/voice -d '{"voiceProfileId":"nope","style":"AUTO","speed":1,"pitch":1,"intonation":1,"speechProfile":"NATIVE"}'
echo "9 preview(422 전 task-003)"; j -X POST $B/api/v1/voices/preview -d '{"voiceProfileId":"teacher_haruka","style":"AUTO","speed":1,"pitch":1,"intonation":1}'
echo "10 speech web";          j $B/api/v1/settings/speech
echo "11 OFFLINE web(400)";    j -X PUT $B/api/v1/settings/speech -d '{"recognitionMode":"OFFLINE"}'
echo "12 OFFLINE app";         j -X PUT -H "X-Client-Platform: app" $B/api/v1/settings/speech -d '{"recognitionMode":"OFFLINE"}'
echo "13 AUTO 복구";           j -X PUT $B/api/v1/settings/speech -d '{"recognitionMode":"AUTO"}'
echo "14 check-in x2";         j -X POST $B/api/v1/attendance/check-in; j -X POST $B/api/v1/attendance/check-in
echo "15 attendance";          j "$B/api/v1/attendance"; j "$B/api/v1/attendance?month=2026-13"
