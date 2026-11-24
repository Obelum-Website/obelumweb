"""Extra facts for the map-page project cards.

Run after tools/build_details.py. Output data/cards.json: {"<id>": [handover, plan], ...}
  handover: the developer's handover as written ("Q2 2027", "Nov 2026"), or null
  plan:     first payment plan in short words ("10% booking · 50% construction · 40% handover"), or null
"""
import glob, json, os, re

def short(name):
    n = (name or "").lower()
    if re.search(r"after handover|post|\bph\b|months after|years after", n): return "after handover"
    if re.search(r"handover|completion|keys", n) and "% of completion" not in n and "construction" not in n: return "on handover"
    if re.search(r"book|down|eoi|reservation|signing|spa", n): return "booking"
    return "during construction"

out = {}
for f in glob.glob("data/p/*.json"):
    d = json.load(open(f))
    ho = d.get("handover")
    if ho:
        ho = re.sub(r"^([A-Z]{3}) ", lambda m: m.group(1).title() + " ", ho.strip())
    plan = None
    plans = d.get("plans") or []
    if plans and plans[0].get("steps"):
        agg = {}
        for s in plans[0]["steps"]:
            k = short(s.get("name")); agg[k] = agg.get(k, 0) + (s.get("pct") or 0)
        order = ["booking", "during construction", "on handover", "after handover"]
        parts = [f"{round(agg[k])}% {k}" for k in order if agg.get(k)]
        if parts and abs(sum(agg.values()) - 100) < 1.5:
            plan = " · ".join(parts)
    if ho or plan:
        out[os.path.basename(f)[:-5]] = [ho, plan]
json.dump(out, open("data/cards.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "projects;", sum(1 for v in out.values() if v[0]), "with handover,", sum(1 for v in out.values() if v[1]), "with plan")
