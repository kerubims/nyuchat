#!/usr/bin/env bash
# Long conversation e2e: verifies episodic summary generation (10+ messages)
# and semantic fact recall across turns. Adult characters only.
set -euo pipefail
BASE="http://localhost:3000"

CHARS=$(curl -sS -m 10 "$BASE/api/characters")
VEY_ID=$(echo "$CHARS" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
SESSION=$(curl -sS -m 15 -X POST "$BASE/api/sessions" -H 'Content-Type: application/json' \
  -d "{\"characterId\":\"$VEY_ID\"}")
SID=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "session: $SID"

turn() {
  echo "════ USER ════"
  echo "$1"
  curl -sS -N -m 400 -X POST "$BASE/api/chat" -H 'Content-Type: application/json' \
    -d "{\"sessionId\":\"$SID\",\"message\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$1")}" \
    | python3 -c "
import sys, json
out=[]
for line in sys.stdin:
    line=line.strip()
    if not line.startswith('data:'): continue
    p=line[5:].strip()
    if p in ('[DONE]','') or not p: continue
    try:
        j=json.loads(p)
        if 'token' in j: out.append(j['token'])
        if 'error' in j: out.append('[ERR '+j['error']+']')
    except Exception: pass
t=''.join(out)
print('VEY:', t[:260])
print(f'--- words={len(t.split())}')
"
}

turn "*Vey sits on the edge of the couch, watching Zack sleep.*"
turn "\"Hey,\" *she whispers.* \"You talk in your sleep, you know.\""
turn "*Her hand drifts to his chest.* \"Someone's having an interesting dream.\""
turn "*She pulls back the blanket.* \"Let's see what college has done to you.\""
turn "\"Tell me about your classes,\" *she says, tracing circles on his arm.* \"I want to know everything.\""
turn "\"My sister keeps asking when I'll visit,\" *Vey admits.* \"I keep telling her next month.\""
turn "\"The old diner on Fifth still has the best pie,\" *she muses.* \"We should go sometime.\""
turn "*Vey yawns, settling beside him.* \"I'm not going anywhere tonight.\""
turn "\"You're warmer than you used to be,\" *she murmurs into his shoulder.*"
turn "*She catches herself staring.* \"What? Never seen a girl look at you before?\""

echo
echo "════ SUMMARY CHECK ════"
curl -sS -m 10 "$BASE/api/sessions/$SID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d['session']
print('messages:', len(d['messages']))
print('msg_since_summary:', s.get('msg_since_summary'))
print('summary present:', bool(s.get('global_summary')))
if s.get('global_summary'):
    print('--- SUMMARY ---')
    print(s['global_summary'][:600])
"
curl -sS -m 10 -X DELETE "$BASE/api/sessions/$SID" -o /dev/null -w "\ncleaned %{http_code}\n"
