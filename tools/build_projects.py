#!/usr/bin/env python3
"""Build data/projects.json for the property search from Reelly search_projects results.

Usage: build_projects.py OUT.json RAW1.txt [RAW2.txt ...]
Each RAW file is one Reelly `search_projects` response ({count, results:[...]}).
If OUT.json already exists, projects in the RAW files replace or add to it by id
(that is how the nightly update merges only the changed projects).
"""
import json, sys, os, re

def year_of(p):
    dt = p.get("completion_datetime") or ""
    if dt[:4].isdigit():
        return int(dt[:4])
    m = re.search(r"(20\d\d)", p.get("completion_date") or "")
    return int(m.group(1)) if m else None

def num(v):
    return round(v) if isinstance(v, (int, float)) and v > 0 else None

def slim(p):
    loc = p.get("location") or {}
    region = (loc.get("region") or "").replace(" Emirate", "").strip() or None
    types = sorted({t.strip().title() for t in (p.get("available_unit_types_display") or []) if t})
    img = (p.get("cover_image") or {}).get("url")
    return {
        "id": p["id"],
        "n": (p.get("name") or "").strip(),
        "dv": (p.get("developer") or "").strip() or None,
        "r": region,
        "a": (loc.get("district") or "").strip() or None,
        "la": loc.get("latitude"), "lo": loc.get("longitude"),
        "p1": num(p.get("min_price")), "p2": num(p.get("max_price")),
        "s1": num(p.get("min_size")), "s2": num(p.get("max_size")),
        "b1": p.get("min_bedrooms"), "b2": p.get("max_bedrooms"),
        "t": types,
        "st": "ready" if p.get("construction_status") == "completed" else "offplan",
        "ss": p.get("sale_status_display"),
        "y": year_of(p),
        "img": img,
        "u": (p.get("updated_at") or "")[:19],
    }

out, raws = sys.argv[1], sys.argv[2:]
db = {}
if os.path.exists(out):
    for p in json.load(open(out))["projects"]:
        db[p["id"]] = p
for f in raws:
    for p in json.load(open(f)).get("results", []):
        if p.get("is_published") is False:
            db.pop(p["id"], None)
            continue
        s = slim(p)
        if s["la"] is None or s["lo"] is None:
            continue
        db[p["id"]] = s
projects = sorted(db.values(), key=lambda p: p["id"])
latest = max((p["u"] for p in projects), default="")
json.dump({"updated": latest, "count": len(projects), "projects": projects},
          open(out, "w"), separators=(",", ":"), ensure_ascii=False)
print(f"{len(projects)} projects, latest update {latest}")
