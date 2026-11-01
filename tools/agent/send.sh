#!/bin/bash
# send.sh — 电脑端向手机执行器发送指令并等待结果
# 用法: ./send.sh '<actions JSON 数组>'
# 示例: ./send.sh '[{"type":"ping"}]'
#       ./send.sh '[{"type":"tap","x":540,"y":1200}]'
ADB="/e/think/tools/platform-tools/adb.exe"
export MSYS_NO_PATHCONV=1

ACTIONS="$1"
if [ -z "$ACTIONS" ]; then
  ACTIONS='[{"type":"ping"}]'
fi

ID="cmd$(date +%s%N)"
TMP="E:/think/tools/agent/.cmd_$ID.json"
printf '{"id":"%s","actions":%s}' "$ID" "$ACTIONS" > "$TMP"

if ! "$ADB" push "$TMP" /sdcard/.agent_cmd.json >/dev/null; then
  echo '{"ok":false,"error":"adb push failed"}'
  rm -f "$TMP"
  exit 1
fi
rm -f "$TMP"

for i in $(seq 1 60); do
  R=$("$ADB" shell cat /sdcard/.agent_result.json 2>/dev/null | tr -d '\r\n')
  case "$R" in
    *"\"id\":\"$ID\""*)
      echo "$R"
      exit 0
      ;;
  esac
  sleep 0.3
done

echo '{"ok":false,"error":"timeout waiting for phone result"}'
exit 1
