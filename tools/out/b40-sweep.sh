#!/bin/bash
cd /f/MyAi/trace/lvyou-v2 || exit 9
LOG=tools/out/b40-sweep.log
: > "$LOG"
echo "SWEEP_START $(date -Is)" >> "$LOG"

run() {
  local name="$1"; shift
  local s e d last
  s=$(date +%s)
  "$@" > "tools/out/b40-leg-${name}.txt" 2>&1
  e=$?
  d=$(( $(date +%s) - s ))
  last=$(tail -4 "tools/out/b40-leg-${name}.txt" | tr '\n' '|' | cut -c1-200)
  printf '%-28s exit=%-3s %4ss  %s\n' "$name" "$e" "$d" "$last" >> "$LOG"
}

run verify node tools/verify.js
for f in tools/smoke.js tools/smoke-*.js; do
  n=$(basename "$f" .js)
  run "$n" node "$f"
done
echo "SWEEP_DONE $(date -Is)" >> "$LOG"
