#!/usr/bin/env python3
"""Write data/payments.json for the map's Payments filter, from the detail files in data/p/.

Run after tools/build_details.py. Output: {"<id>": [post, booking, handover], ...}
  post      1 if the project has a post-handover payment plan, else 0
  booking   the lowest down payment (% on booking) across its plans, or null
  handover  the lowest share (%) paid by handover, i.e. 100 - post-handover part, or null
Only projects with at least one payment plan are listed.
"""
import glob, json, os, re

out = {}
for f in glob.glob("data/p/*.json"):
    d = json.load(open(f))
    plans = d.get("plans") or []
    if not plans:
        continue
    post = bool(d.get("post_handover")) or any(p.get("post") for p in plans)
    bookings, by_ho = [], []
    for p in plans:
        steps = p.get("steps") or []
        bk = sum(s["pct"] for s in steps if re.search(r"book|down|eoi|reservation|signing", s["name"] or "", re.I))
        if not bk and steps:
            bk = steps[0]["pct"]
        bookings.append(bk)
        ph = sum(s["pct"] for s in steps if re.search(r"post|after handover|\bPH\b|months after", s["name"] or "", re.I))
        if ph:
            post = True
        by_ho.append(round(100 - ph))
    out[os.path.basename(f)[:-5]] = [1 if post else 0, round(min(bookings)) if bookings else None, min(by_ho) if by_ho else None]
json.dump(out, open("data/payments.json", "w"), separators=(",", ":"))
print(len(out), "projects with payment plans;", sum(v[0] for v in out.values()), "with post-handover")
