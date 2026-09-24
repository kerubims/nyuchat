#!/usr/bin/env bash
# Full HTTP e2e through the running dev server: session -> translate -> chat stream.
set -euo pipefail
BASE="http://localhost:3000"

echo "== /api/characters =="
CHARS=$(curl -sS -m 10 "$BASE/api/characters")
VEY_ID=$(echo "$CHARS" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
echo "character: $VEY_ID"

echo "== create session =="
SESSION=$(curl -sS -m 15 -X POST "$BASE/api/sessions" -H 'Content-Type: application/json' \
  -d "{\"characterId\":\"$VEY_ID\"}")
SID=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "session: $SID"

echo "== /api/translate (id -> en) =="
curl -sS -m 20 -X POST "$BASE/api/translate" -H 'Content-Type: application/json' \
  -d '{"text":"Aku penasaran sama orang yang sedang tidur di sofa itu"}' | python3 -m json.tool

echo "== /api/chat (stream) =="
curl -sS -N -m 180 -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"message\":\"*Vey leans closer, curious about the young man sleeping on the couch.*\"}" \
  | head -c 4000

echo
echo "== session history =="
curl -sS -m 10 "$BASE/api/sessions/$SID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for m in d['messages']:
    print(f\"--- {m['sender']} ({len(m['content'].split())} words)\")
    print(m['content'][:400])
"

echo "== cleanup =="
curl -sS -m 10 -X DELETE "$BASE/api/sessions/$SID" -o /dev/null -w "deleted %{http_code}\n"
