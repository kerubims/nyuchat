#!/usr/bin/env python3
"""E2E test suite for nyuchat chat room, run against localhost:3000 via CDP."""
import json, sys, time, urllib.request, websocket

CDP = "http://127.0.0.1:9223"
PASS, FAIL = [], []

def conn():
    tabs = [t for t in json.load(urllib.request.urlopen(f"{CDP}/json/list", timeout=8)) if t.get("type") == "page"]
    ws = websocket.create_connection(tabs[0]["webSocketDebuggerUrl"], timeout=120)
    mid = [0]
    def cmd(m, **p):
        mid[0] += 1
        ws.send(json.dumps({"id": mid[0], "method": m, "params": p}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == mid[0]:
                return r.get("result", {})
    def js(e):
        return cmd("Runtime.evaluate", expression=e, returnByValue=True, awaitPromise=True).get("result", {}).get("value")
    cmd("Page.enable"); cmd("Runtime.enable")
    return cmd, js

def check(name, cond, extra=""):
    if cond:
        PASS.append(name); print(f"  PASS  {name}")
    else:
        FAIL.append(name); print(f"  FAIL  {name} {extra}")

def api(method, path, body=None, timeout=240):
    data = json.dumps(body).encode() if body else None
    try:
        r = urllib.request.urlopen(urllib.request.Request(f"http://localhost:3000{path}", data=data,
            headers={"Content-Type": "application/json"}, method=method), timeout=timeout)
        return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def main():
    cmd, js = conn()

    print("\n== E1: fresh session + chat send ==")
    st, b = api("POST", "/api/sessions", {"characterId": "vey"})
    sid = json.loads(b)["id"]; open("/tmp/e2e_sid.txt", "w").write(sid)
    check("create session 201", st == 201, f"got {st}")

    st, b = api("POST", "/api/chat", {"sessionId": sid, "message": "Halo Vey, lagi apa?"})
    check("chat POST 200", st == 200, f"got {st}")
    body = b.decode()
    check("stream has tokens", '"token"' in body)
    mid = None
    for line in body.split("\n"):
        if '"messageId"' in line:
            mid = json.loads(line.replace("data: ", ""))["messageId"]; break
    check("got assistant messageId", bool(mid))

    st, b = api("GET", f"/api/sessions/{sid}")
    ms = json.loads(b).get("messages") or []
    check("3 msgs persisted", len(ms) == 3, f"got {len(ms)}")
    check("user msg persisted", any(m["sender"] == "user" and "Halo Vey" in m["content"] for m in ms))

    print("\n== E2: regenerate (data-loss + stuck regression) ==")
    # force the 400 path: wipe session msgs via regen on a session with no user msg
    st, b = api("POST", "/api/sessions", {"characterId": "vey"})
    empty_sid = json.loads(b)["id"]
    st, b = api("POST", "/api/chat", {"sessionId": empty_sid, "regenerateMessageId": "nonexistent"})
    check("regen on empty session rejected 400", st == 400, f"got {st}")
    # Server rejected BEFORE any delete (fix #2); verify via a session WITH history
    # but where the regenerate id is stale (fallback path) — user msg must survive.
    st, b = api("POST", "/api/chat", {"sessionId": sid, "regenerateMessageId": "definitely-stale-id"})
    check("regen stale-id falls back, user msg survives", st == 200, f"got {st}")
    st, b = api("GET", f"/api/sessions/{sid}")
    ms_reg = json.loads(b).get("messages") or []
    check("user msg survived stale-id regen", any(m["sender"] == "user" for m in ms_reg), f"msgs={len(ms_reg)}")

    # happy path regen on real session
    st, b = api("POST", "/api/chat", {"sessionId": sid, "regenerateMessageId": mid, "temperature": 0.8})
    check("regen POST 200", st == 200, f"got {st}")
    st, b = api("GET", f"/api/sessions/{sid}")
    ms2 = json.loads(b).get("messages") or []
    check("user msg survived regen", any(m["sender"] == "user" and "Halo Vey" in m["content"] for m in ms2))
    check("assistant replaced (new id)", len([m for m in ms2 if m["sender"] == "assistant"]) == 2)
    check("total msgs still 3", len(ms2) == 3, f"got {len(ms2)}")

    print("\n== E3: translate API ==")
    st, b = api("POST", "/api/translate", {"text": "Good morning, how are you?", "from": "en", "to": "id"})
    check("translate 200", st == 200, f"got {st}")
    tr = json.loads(b)
    check("translation returned", bool(tr.get("translation")), str(tr)[:120])

    print("\n== E4: UI — session switch respects initialSessionId ==")
    cmd("Page.navigate", url=f"http://localhost:3000/chat/vey?sessionId={sid}")
    # wait for messages container to render (retry up to 60s)
    loaded = 'none'
    for i in range(30):
        time.sleep(2)
        loaded = js("""(()=>{const cont=[...document.querySelectorAll('main > section > div')]
          .find(d=>d.className.includes('overflow-y-auto'));
          if(!cont||!cont.firstElementChild) return 'none';
          const m=[...cont.firstElementChild.children].pop();
          return m?(m.innerText||'').slice(0,80):'none'})()""") or 'none'
        if loaded != 'none':
            break
    check("UI loaded messages", loaded != "none", str(loaded)[:100])

    print("\n== E5: UI — regenerate stuck regression ==")
    js("""(()=>{window.__net=[];const o=window.fetch;
      window.fetch=function(u,opts){const url=typeof u==='string'?u:u.url;
      window.__net.push({url,s:0});const p=o.apply(this,arguments);
      p.then(r=>window.__net.push({url,s:r.status})).catch(e=>window.__net.push({url,e:1}));
      return p;};return 1})()""")
    # regen button lives on the LAST assistant bubble
    clicked = False
    for i in range(20):
        clicked = js("""(()=>{const cont=[...document.querySelectorAll('main > section > div')]
          .find(d=>d.className.includes('overflow-y-auto'));
          if(!cont||!cont.firstElementChild) return false;
          const bubbles=[...cont.firstElementChild.children];
          const b=[...bubbles.pop().querySelectorAll('button')].find(x=>x.title==='Regenerate Balasan');
          if(!b) return false; b.click(); return true})()""") or False
        if clicked: break
        time.sleep(2)
    check("regen button present", bool(clicked))
    for i in range(70):
        time.sleep(3)
        t = js("""(()=>{const cont=[...document.querySelectorAll('main > section > div')]
            .find(d=>d.className.includes('overflow-y-auto'));
            if(!cont) return 'none';
            const m=[...cont.firstElementChild.children].pop();
            return m?(m.innerText||'').slice(0,60):'none'})()""") or ""
        if "Regenerating" not in t and i > 0:
            check("regen completes, not stuck", True, f"{i*3}s")
            break
    else:
        check("regen completes, not stuck", False, "stuck >210s")

    print("\n== E6: UI — edit + cancel ==")
    # edit button lives on user message bubbles; wait for one to appear
    clicked_edit = False
    for i in range(20):
        clicked_edit = js("""(()=>{const b=[...document.querySelectorAll('button[title="Edit message"]')].pop();
          if(!b) return false; b.click(); return true})()""") or False
        if clicked_edit: break
        time.sleep(2)
    time.sleep(1)
    check("edit banner shown", bool(js("document.body.innerText.includes('Editing message')")))
    js("[...document.querySelectorAll('button')].find(b=>b.innerText==='Cancel')?.click();1")
    time.sleep(1)
    check("edit banner cleared", not bool(js("document.body.innerText.includes('Editing message')")))
    iv = js("(()=>{const t=document.querySelector('textarea');return t?t.value:''})()")
    check("input cleared on cancel", iv == "", repr(iv)[:60])

    print(f"\n=== RESULT: {len(PASS)} pass, {len(FAIL)} fail ===")
    for f in FAIL:
        print("  FAILED:", f)
    return 1 if FAIL else 0

if __name__ == "__main__":
    sys.exit(main())
