"""Turn the downloaded studies into the dashboard's data files.

Usage: python3 build.py STUDIES.jsonl OUTDIR RUN_DATE(YYYY-MM-DD) [PREV_SNAPSHOT.csv]

Writes CSV/JSON files sized for the dashboard (each under 8 MB), plus
snapshot.csv (id,status) to compare against next week.
"""
import csv, json, os, sys, datetime
from collections import Counter, defaultdict

STATUS_CODE = {
    "RECRUITING": "R", "NOT_YET_RECRUITING": "N", "ENROLLING_BY_INVITATION": "E",
    "ACTIVE_NOT_RECRUITING": "A", "COMPLETED": "C", "SUSPENDED": "S",
    "TERMINATED": "T", "WITHDRAWN": "W", "UNKNOWN": "U", "AVAILABLE": "V",
    "NO_LONGER_AVAILABLE": "L", "TEMPORARILY_NOT_AVAILABLE": "P",
    "APPROVED_FOR_MARKETING": "M", "WITHHELD": "H",
}
CODE_STATUS = {v: k for k, v in STATUS_CODE.items()}
OPEN = {"RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"}
PHASE_LABEL = {
    "EARLY_PHASE1": "Early phase 1", "PHASE1": "Phase 1", "PHASE2": "Phase 2",
    "PHASE3": "Phase 3", "PHASE4": "Phase 4", "NA": "Not applicable",
}
MAX_SHARD = 7_900_000
SHARDS = 5


def phase_of(t):
    ph = t["ph"]
    if not ph:
        return "Not applicable" if t["ty"] == "INTERVENTIONAL" else "Observational / other"
    return " / ".join(PHASE_LABEL.get(p, p) for p in ph)


def clip(s, n):
    s = (s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def countries_text(co, n=6):
    if len(co) <= n:
        return "; ".join(co)
    return "; ".join(co[:n]) + f"; +{len(co) - n} more"


def write_csv(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main(src, out, run_date, prev=None):
    os.makedirs(out, exist_ok=True)
    today = datetime.date.fromisoformat(run_date)
    week_ago = (today - datetime.timedelta(days=7)).isoformat()

    prev_status = {}
    if prev and os.path.exists(prev):
        with open(prev) as f:
            for line in f:
                line = line.strip()
                if line and "," in line:
                    k, v = line.split(",", 1)
                    if k.isdigit():
                        prev_status["NCT" + k.zfill(8)] = CODE_STATUS.get(v, v)

    status = Counter(); phase = Counter(); year = Counter(); sponsor = Counter()
    ctry = Counter(); ctry_open = Counter()
    cond = Counter(); cond_open = Counter(); cond_name = defaultdict(Counter)
    with_results = 0; total = 0
    new_rows = []; changes = []; open_rows = []; snap = []

    with open(src) as f:
        for line in f:
            t = json.loads(line)
            if not t.get("id"):
                continue
            total += 1
            s = t["s"]; is_open = s in OPEN
            status[s] += 1
            ph = phase_of(t)
            if t["ty"] == "INTERVENTIONAL":
                phase[ph] += 1
            y = (t["fp"] or "")[:4]
            if y.isdigit():
                year[int(y)] += 1
            sponsor[t["sc"] or "UNKNOWN"] += 1
            if t["r"]:
                with_results += 1
            for c in t["co"]:
                ctry[c] += 1
                if is_open:
                    ctry_open[c] += 1
            seen = set()
            for c in t["c"]:
                k = c.strip().lower()
                if not k or k in seen:
                    continue
                seen.add(k)
                cond[k] += 1; cond_name[k][c.strip()] += 1
                if is_open:
                    cond_open[k] += 1

            conds = clip("; ".join(t["c"][:3]), 90)
            if t["fp"] and t["fp"] >= week_ago:
                new_rows.append([t["id"], clip(t["t"], 160), s, ph, conds,
                                 countries_text(t["co"]), t["fp"]])
            if prev_status and t["id"] in prev_status and prev_status[t["id"]] != s:
                changes.append([t["id"], clip(t["t"], 160), prev_status[t["id"]], s, t["lu"]])
            if is_open:
                open_rows.append([t["id"], clip(t["t"], 130), s, ph, conds,
                                  "; ".join(t["co"]), t["amin"], t["amax"],
                                  t["sex"], "Yes" if t["hv"] else "No",
                                  t["ty"], t["lu"]])
            snap.append(f"{int(t['id'][3:])},{STATUS_CODE.get(s, s)}")

    # Small summary tables
    summary = [
        {"metric": "total", "value": total},
        {"metric": "open", "value": sum(status[s] for s in OPEN)},
        {"metric": "recruiting", "value": status["RECRUITING"]},
        {"metric": "completed", "value": status["COMPLETED"]},
        {"metric": "with_results", "value": with_results},
        {"metric": "countries", "value": len(ctry)},
        {"metric": "new_week", "value": len(new_rows)},
        {"metric": "changed_week", "value": len(changes)},
        {"metric": "compared", "value": 1 if prev_status else 0},
    ]
    with open(os.path.join(out, "summary.json"), "w") as f:
        json.dump({"rows": summary, "refreshed": run_date}, f)
    with open(os.path.join(out, "refreshed.json"), "w") as f:
        json.dump([{"refreshed": run_date, "week_start": week_ago}], f)

    write_csv(os.path.join(out, "by_status.csv"), ["status", "trials"],
              sorted(status.items(), key=lambda x: -x[1]))
    order = ["Early phase 1", "Phase 1", "Phase 1 / Phase 2", "Phase 2",
             "Phase 2 / Phase 3", "Phase 3", "Phase 4", "Not applicable"]
    write_csv(os.path.join(out, "by_phase.csv"), ["phase", "trials"],
              [[p, phase[p]] for p in order if phase[p]])
    write_csv(os.path.join(out, "by_year.csv"), ["year", "trials"],
              [[y, year[y]] for y in sorted(year) if 2000 <= y <= today.year])
    write_csv(os.path.join(out, "by_sponsor.csv"), ["sponsor_type", "trials"],
              sorted(sponsor.items(), key=lambda x: -x[1]))
    write_csv(os.path.join(out, "by_country.csv"), ["country", "trials", "open_trials"],
              [[c, n, ctry_open[c]] for c, n in sorted(ctry.items(), key=lambda x: -x[1])])
    top = sorted(cond.items(), key=lambda x: -x[1])[:150]
    write_csv(os.path.join(out, "by_condition.csv"), ["condition", "trials", "open_trials"],
              [[cond_name[k].most_common(1)[0][0], n, cond_open[k]] for k, n in top])
    write_csv(os.path.join(out, "new_week.csv"),
              ["id", "title", "status", "phase", "conditions", "countries", "first_posted"],
              sorted(new_rows, key=lambda r: r[6], reverse=True))
    write_csv(os.path.join(out, "status_changes.csv"),
              ["id", "title", "from_status", "to_status", "last_update"],
              sorted(changes, key=lambda r: r[4], reverse=True))

    # Open trials, sharded under the size limit
    header = ["id", "title", "status", "phase", "conditions", "countries",
              "min_age", "max_age", "sex", "healthy_volunteers", "study_type", "last_update"]
    open_rows.sort(key=lambda r: r[0])
    # Always exactly SHARDS parts, so the page's dataset ids never change.
    per = -(-len(open_rows) // SHARDS) if open_rows else 0
    for i in range(SHARDS):
        part = open_rows[i * per:(i + 1) * per]
        path = os.path.join(out, f"open_trials_{i + 1}.csv")
        write_csv(path, header, part)
        if os.path.getsize(path) > MAX_SHARD:
            raise SystemExit(f"{path} is over the 8 MB dataset limit; raise SHARDS")
    with open(os.path.join(out, "snapshot.csv"), "w") as f:
        f.write("\n".join(snap) + "\n")
    print(json.dumps({"total": total, "open": len(open_rows), "shards": SHARDS,
                      "new_week": len(new_rows), "changes": len(changes),
                      "compared": bool(prev_status)}))


if __name__ == "__main__":
    main(*sys.argv[1:])
