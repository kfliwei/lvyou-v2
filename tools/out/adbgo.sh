#!/usr/bin/env bash
ADB="D:/Android/Sdk/platform-tools/adb.exe"
ensure(){
  for i in 1 2 3 4 5; do
    st=$("$ADB" devices | sed -n '2p')
    case "$st" in *$'\t'device*) return 0;; esac
    "$ADB" kill-server >/dev/null 2>&1; sleep 2; "$ADB" start-server >/dev/null 2>&1; sleep 3
  done
  echo "ADB_OFFLINE" >&2; return 1
}
