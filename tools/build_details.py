#!/usr/bin/env python3
"""Write one small detail file per project, data/p/<id>.json, for the project pop-up.

Usage: build_details.py OUT_DIR RAW1.txt [RAW2.txt ...]
RAW files are Reelly responses: `search_projects` ({results:[...]}) gives the
description and basics; `get_projects` with response_format "detailed"
({projects:[...]}) adds photos, units by bedroom, payment plans, amenities and
nearby places. A detailed response always wins over a search one, and an
existing detailed file is never downgraded by a later search-only update.
"""
import json, os, sys

def img(o):
    return (o or {}).get("url") if isinstance(o, dict) else None

def num(v):
    return round(v) if isinstance(v, (int, float)) and v > 0 else None

def basic(p):
    return {
        "id": p["id"],
        "desc": (p.get("overview") or "").strip(),
        "start": p.get("construction_start_date"),
        "end": p.get("construction_end_date"),
        "handover": (p.get("completion_date") or "").strip() or None,
        "buildings": p.get("building_count"),
        "s1": num(p.get("min_size")), "s2": num(p.get("max_size")),
        "photos": [u for u in [img(p.get("cover_image"))] if u],
        "detailed": False,
    }

def detailed(p):
    d = basic(p)
    photos = []
    for key in ("architecture", "interior", "lobby"):
        for o in p.get(key) or []:
            u = img(o)
            if u and u not in photos:
                photos.append(u)
    cover = img(p.get("cover_image"))
    if cover and cover not in photos:
        photos.insert(0, cover)
    d["photos"] = photos[:16]

    # Units grouped by bedroom count: price and size ranges, plus one layout image.
    units = {}
    for u in p.get("typical_units") or []:
        b = u.get("bedrooms")
        if b is None:
            continue
        g = units.setdefault(b, {"beds": b, "p1": None, "p2": None, "s1": None, "s2": None, "n": 0, "layout": None})
        g["n"] += 1
        for lo, hi, a, z in (("p1", "p2", "from_price_aed", "to_price_aed"), ("s1", "s2", "from_size_sqft", "to_size_sqft")):
            for v in (num(u.get(a)), num(u.get(z))):
                if v:
                    g[lo] = v if g[lo] is None else min(g[lo], v)
                    g[hi] = v if g[hi] is None else max(g[hi], v)
        if not g["layout"]:
            for l in u.get("layout") or []:
                if img(l.get("image")):
                    g["layout"] = img(l.get("image"))
                    break
    d["units"] = [units[k] for k in sorted(units)]

    plans = []
    for pp in p.get("payment_plans") or []:
        steps = [{"name": (s.get("name") or "").strip(), "pct": s.get("percentage")}
                 for s in pp.get("steps") or [] if s.get("percentage")]
        if steps:
            plans.append({"name": (pp.get("name") or "Payment plan").strip(), "steps": steps,
                          "post": bool(pp.get("is_handover") or pp.get("months_after_handover"))})
    d["plans"] = plans[:4]
    d["amenities"] = [a["amenity"]["name"] for a in p.get("project_amenities") or [] if (a.get("amenity") or {}).get("name")][:24]
    d["nearby"] = [{"name": m.get("map_point_name"), "km": m.get("distance")} for m in p.get("project_map_points") or [] if m.get("map_point_name")][:8]
    d["furnishing"] = p.get("furnishing_display") or None
    d["service_charge"] = p.get("service_charge") or None
    d["post_handover"] = bool(p.get("post_handover"))
    d["detailed"] = True
    return d

out, raws = sys.argv[1], sys.argv[2:]
os.makedirs(out, exist_ok=True)
written = {"basic": 0, "detailed": 0}
for f in raws:
    j = json.load(open(f))
    if "projects" in j:
        items, make = j["projects"], detailed
    else:
        items, make = j.get("results", []), basic
    for p in items:
        path = os.path.join(out, f"{p['id']}.json")
        d = make(p)
        if not d["detailed"] and os.path.exists(path):
            old = json.load(open(path))
            if old.get("detailed"):
                # keep the rich file, refresh only the basics that a search carries
                old.update({k: d[k] for k in ("desc", "handover", "start", "end", "s1", "s2") if d.get(k)})
                d = old
        json.dump(d, open(path, "w"), separators=(",", ":"), ensure_ascii=False)
        written["detailed" if d["detailed"] else "basic"] += 1
print(written)
