#!/usr/bin/env bash
# Multi-turn NSFW roleplay e2e with adult characters (all 18+).
# Verifies: streaming persistence, dialogue ratio, word budget, episodic summary.
set -euo pipefail
BASE="http://localhost:3000"

CHARS=$(curl -sS -m 10 "$BASE/api/characters")
VEY_ID=$(echo "$CHARS" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
SESSION=$(curl -sS -m 15 -X POST "$BASE/api/sessions" -H 'Content-Type: application/json' \
  -d "{\"characterId\":\"$VEY_ID\"}")
SID=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "session: $SID"

turn() {
  local msg="$1"
  echo
  echo "════ USER ════"
  echo "$msg"
  echo "════ VEY ════"
  curl -sS -N -m 240 -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
    -d "{\"sessionId\":\"$SID\",\"message\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$msg")}" \
    | python3 -c "
import sys, json
out = []
for line in sys.stdin:
    line = line.strip()
    if not line.startswith('data:'): continue
    p = line[5:].strip()
    if p == '[DONE]' or not p: continue
    try:
        j = json.loads(p)
        if 'token' in j: out.append(j['token'])
        if 'error' in j: out.append('[ERROR '+j['error']+']')
    except Exception: pass
text = ''.join(out)
words = text.split()
q = sum(1 for w in words if '\"' in w or '?' in w)
print(text)
print()
print(f'--- words={len(words)}  question={\"?\" in text}')
"
}

turn "*Vey sits on the edge of the couch, watching Zack sleep, her fingers tracing idle patterns on the blanket.*"
turn "*She leans closer, her breath warm against his cheek.* \"Hey,\" *she whispers.* \"You talk in your sleep, you know.\""
turn "*Vey's hand drifts to his chest, feeling his heartbeat quicken under her palm.* \"Someone's having an interesting dream,\" *she murmurs, smirking.*"
turn "*She pulls back the blanket, curiosity and something darker flickering in her eyes.* \"Let's see what college has done to you.\""

echo
echo "════ FINAL HISTORY ════"
curl -sS -m 10 "$BASE/api/sessions/$SID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
msgs=d['messages']
print('total messages:', len(msgs))
for m in msgs:
    tag = 'USER' if m['sender']=='user' else 'VEY '
    print(f'--- {tag} ({len(m[\"content\"].split())}w) {m[\"content\"][:150]}')
s=d['session']
print()
print('summary present:', bool(s.get('global_summary')))
if s.get('global_summary'): print('SUMMARY:', s['global_summary'][:400])
print('msg_since_summary:', s.get('msg_since_summary'))
"
curl -sS -m 10 -X DELETE "$BASE/api/sessions/$SID" -o /dev/null -w "\ncleaned %{http_code}\n"
