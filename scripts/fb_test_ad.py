#!/usr/bin/env python3
"""
naveen labs me ek PAUSED test ad banata hai, aur har API call ko document karta hai.

PAUSED isliye: campaign, adset, creative aur ad — chaaron ban jaate hain aur
poora API path exercise ho jaata hai, par ad serve nahi hota, toh kharcha zero.

Har request ka URL, params (token redacted), HTTP status aur response body
ek markdown log me jaata hai.

Env:
  FB_TOKEN_FILE   token wali file ka path (token kabhi log me nahi jaata)
  ACCOUNT         default act_4522342371386479 (naveen labs)
  APP_ID          default 897513362771883 (Zumo)
  DAILY_BUDGET    paise me, default 20000 (= Rs 200)
  OUT             markdown log ka path
"""
import json, os, sys, time, urllib.parse, urllib.request, zlib, struct, datetime

API = "https://graph.facebook.com/v21.0"
ACCOUNT = os.environ.get("ACCOUNT", "act_4522342371386479")
APP_ID = os.environ.get("APP_ID", "897513362771883")
STORE_URL = "http://play.google.com/store/apps/details?id=com.zumo.android"
PAGE_ID = "774003065792115"
DAILY_BUDGET = os.environ.get("DAILY_BUDGET", "20000")   # paise
OUT = os.environ.get("OUT", "docs/fb-test-ad-log.md")

TOKEN = open(os.environ["FB_TOKEN_FILE"]).read().strip()
LOG = []
created = {}


def redact(s: str) -> str:
    return s.replace(TOKEN, "<TOKEN>") if TOKEN else s


def call(step: str, method: str, path: str, params: dict, files=None):
    """Ek Graph API call + poora log. Token har jagah redact hota hai."""
    url = f"{API}/{path}"
    body_desc = {k: (v if len(str(v)) < 400 else str(v)[:400] + " …") for k, v in params.items()}
    entry = {"step": step, "method": method, "url": url, "params": body_desc}
    t0 = time.time()

    p = dict(params)
    p["access_token"] = TOKEN
    try:
        if files:
            # multipart, sirf image upload ke liye
            boundary = "----fbtest" + str(int(time.time()))
            parts = []
            for k, v in p.items():
                parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
            for fname, fbytes in files.items():
                parts.append(
                    f"--{boundary}\r\nContent-Disposition: form-data; name=\"{fname}\"; filename=\"{fname}.png\"\r\n"
                    f"Content-Type: image/png\r\n\r\n".encode() + fbytes + b"\r\n")
            parts.append(f"--{boundary}--\r\n".encode())
            data = b"".join(parts)
            req = urllib.request.Request(url, data=data, method="POST")
            req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        elif method == "POST":
            req = urllib.request.Request(url, data=urllib.parse.urlencode(p).encode(), method="POST")
        else:
            req = urllib.request.Request(url + "?" + urllib.parse.urlencode(p), method="GET")

        with urllib.request.urlopen(req, timeout=60) as r:
            status, raw = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read().decode()
    except Exception as e:
        status, raw = 0, json.dumps({"transport_error": str(e)})

    ms = int((time.time() - t0) * 1000)
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = {"raw": raw[:600]}
    entry.update({"status": status, "ms": ms, "response": parsed})
    LOG.append(entry)

    ok = 200 <= status < 300
    print(f"  {'✓' if ok else '✗'} {step:<24} HTTP {status} ({ms} ms)")
    if not ok:
        err = parsed.get("error", {})
        print(f"      {err.get('message', str(parsed)[:180])[:180]}")
        if err.get("error_user_msg"):
            print(f"      hint: {err['error_user_msg'][:160]}")
    return ok, parsed


def make_png(w=1080, h=1080, rgb=(28, 30, 38)) -> bytes:
    """Bina kisi dependency ke ek solid-colour PNG."""
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6))
            + chunk(b"IEND", b""))


stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
name = f"CLAUDE TEST {stamp}"
print(f"  account={ACCOUNT}  app={APP_ID}  budget={int(DAILY_BUDGET)/100:.0f} INR/din  status=PAUSED")

# 1 — image upload
ok, r = call("1. upload image", "POST", f"{ACCOUNT}/adimages", {}, files={"source": make_png()})
image_hash = None
if ok:
    imgs = r.get("images", {})
    if imgs:
        image_hash = list(imgs.values())[0].get("hash")
    print(f"      image_hash={image_hash}")
if not image_hash:
    image_hash = "2d54b0081d97dfea6a56aff886d00c8c"   # maujooda creative se
    print(f"      upload nahi hua — purana hash use kar raha hoon")

# 2 — campaign
REUSE_CAMPAIGN = os.environ.get("CAMPAIGN_ID")
REUSE_ADSET = os.environ.get("ADSET_ID")

if REUSE_CAMPAIGN and REUSE_ADSET:
    created["campaign_id"], created["adset_id"] = REUSE_CAMPAIGN, REUSE_ADSET
    print(f"      pehle se bane campaign/adset reuse kar raha hoon")
    ok = True
else:
  ok, r = call("2. create campaign", "POST", f"{ACCOUNT}/campaigns", {
    "name": name, "objective": "OUTCOME_APP_PROMOTION", "status": "PAUSED",
    "buying_type": "AUCTION", "special_ad_categories": "[]",
    # Budget adset par hai, campaign par nahi — FB ye field explicitly maangta hai.
    "is_adset_budget_sharing_enabled": "false",
})
  if not ok:
    print("\n  campaign hi nahi bana — ruk raha hoon"); sys.exit(1)
  created["campaign_id"] = r["id"]

# 3 — adset
targeting = {
    "geo_locations": {"countries": ["IN"]},
    "age_min": 18, "age_max": 65,
    "user_os": ["Android"],
    "app_install_state": "not_installed",
}
if not (REUSE_CAMPAIGN and REUSE_ADSET):
    ok, r = call("3. create adset", "POST", f"{ACCOUNT}/adsets", {
        "name": name, "campaign_id": created["campaign_id"], "status": "PAUSED",
        "daily_budget": DAILY_BUDGET,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "APP_INSTALLS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "promoted_object": json.dumps({"application_id": APP_ID, "object_store_url": STORE_URL}),
        "targeting": json.dumps(targeting),
    })
    if ok:
        created["adset_id"] = r["id"]

# 4 — creative
if "adset_id" in created:
    story = {
        "page_id": PAGE_ID,
        "link_data": {
            "link": STORE_URL,
            "message": "Test creative — Claude ne API se banaya (PAUSED).",
            "name": "Zumo",
            "image_hash": image_hash,
            "call_to_action": {"type": "INSTALL_MOBILE_APP", "value": {"link": STORE_URL}},
        },
    }
    ok, r = call("4. create creative", "POST", f"{ACCOUNT}/adcreatives", {
        "name": name, "object_story_spec": json.dumps(story),
    })
    if ok:
        created["creative_id"] = r["id"]
    else:
        # Naya creative is token se nahi ban sakta: page zaroori hai, aur us page
        # ka Instagram account is ad account ki pahunch me nahi. Iske liye
        # instagram_basic / business_management scope chahiye. Ad banane ka path
        # phir bhi test karna hai, isliye ek maujooda creative reuse kar lete hain.
        ok2, r2 = call("4b. reuse existing creative", "GET", f"{ACCOUNT}/adcreatives",
                       {"fields": "id,name", "limit": "1"})
        if ok2 and r2.get("data"):
            created["creative_id"] = r2["data"][0]["id"]
            created["creative_note"] = "maujooda creative reuse kiya (naya banane ki permission nahi)"
            print(f"      fallback creative_id={created['creative_id']}")

# 5 — ad
if "creative_id" in created:
    ok, r = call("5. create ad", "POST", f"{ACCOUNT}/ads", {
        "name": name, "adset_id": created["adset_id"],
        "creative": json.dumps({"creative_id": created["creative_id"]}),
        "status": "PAUSED",
    })
    if ok:
        created["ad_id"] = r["id"]

# 6 — wapas padh kar tasdeeq
if "ad_id" in created:
    call("6. verify ad", "GET", created["ad_id"],
         {"fields": "id,name,status,effective_status,adset_id,creative"})

# ── markdown log ────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
with open(OUT, "w") as f:
    f.write(f"# Facebook test ad — API log\n\n")
    f.write(f"- Banaya: {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M UTC}\n")
    f.write(f"- Account: `{ACCOUNT}` (naveen labs)\n")
    f.write(f"- App: `{APP_ID}` (Zumo)\n")
    f.write(f"- Status: **PAUSED** — koi delivery nahi, kharcha zero\n")
    f.write(f"- Daily budget set: ₹{int(DAILY_BUDGET)/100:.0f} (paused hone se kharch nahi hoga)\n")
    f.write(f"- API version: v21.0\n\n")
    f.write("## Kya bana\n\n| Object | ID |\n|---|---|\n")
    for k, v in created.items():
        f.write(f"| {k} | `{v}` |\n")
    f.write("\n## Har API call\n\n")
    for e in LOG:
        f.write(f"### {e['step']}\n\n")
        f.write(f"`{e['method']} {redact(e['url'])}`  → **HTTP {e['status']}** ({e['ms']} ms)\n\n")
        f.write("Request params:\n\n```json\n" + redact(json.dumps(e["params"], indent=2)) + "\n```\n\n")
        f.write("Response:\n\n```json\n" + redact(json.dumps(e["response"], indent=2)[:1800]) + "\n```\n\n")

print(f"\n  bana: {json.dumps(created)}")
print(f"  log : {OUT}")
