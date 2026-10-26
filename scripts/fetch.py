"""Download every study from ClinicalTrials.gov API v2 (compact fields) to a JSONL file.

Usage: python3 fetch.py OUT.jsonl
"""
import json, sys, time, urllib.request, urllib.parse

API = "https://clinicaltrials.gov/api/v2/studies"
FIELDS = ",".join([
    "NCTId", "BriefTitle", "OverallStatus", "Phase", "Condition",
    "LocationCountry", "LastUpdatePostDate", "StudyFirstPostDate",
    "StartDate", "LeadSponsorClass", "LeadSponsorName", "StudyType",
    "HasResults", "MinimumAge", "MaximumAge", "Sex", "HealthyVolunteers",
    "InterventionType", "EnrollmentCount",
])


def get(params, tries=6):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # retry with backoff
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def g(d, *path, default=None):
    for p in path:
        if not isinstance(d, dict):
            return default
        d = d.get(p)
    return d if d is not None else default


def compact(s):
    p = s.get("protocolSection", {})
    locs = g(p, "contactsLocationsModule", "locations", default=[]) or []
    countries = sorted({l.get("country") for l in locs if l.get("country")})
    ivs = g(p, "armsInterventionsModule", "interventions", default=[]) or []
    return {
        "id": g(p, "identificationModule", "nctId"),
        "t": g(p, "identificationModule", "briefTitle", default=""),
        "s": g(p, "statusModule", "overallStatus", default="UNKNOWN"),
        "ph": g(p, "designModule", "phases", default=[]) or [],
        "ty": g(p, "designModule", "studyType", default=""),
        "c": g(p, "conditionsModule", "conditions", default=[]) or [],
        "co": countries,
        "fp": g(p, "statusModule", "studyFirstPostDateStruct", "date", default=""),
        "lu": g(p, "statusModule", "lastUpdatePostDateStruct", "date", default=""),
        "sd": g(p, "statusModule", "startDateStruct", "date", default=""),
        "sc": g(p, "sponsorCollaboratorsModule", "leadSponsor", "class", default=""),
        "sn": g(p, "sponsorCollaboratorsModule", "leadSponsor", "name", default=""),
        "r": bool(s.get("hasResults")),
        "amin": g(p, "eligibilityModule", "minimumAge", default=""),
        "amax": g(p, "eligibilityModule", "maximumAge", default=""),
        "sex": g(p, "eligibilityModule", "sex", default=""),
        "hv": bool(g(p, "eligibilityModule", "healthyVolunteers", default=False)),
        "it": sorted({i.get("type") for i in ivs if i.get("type")}),
        "n": g(p, "designModule", "enrollmentInfo", "count", default=None),
    }


def main(out):
    params = {"pageSize": 1000, "fields": FIELDS, "countTotal": "true"}
    n = 0
    with open(out, "w") as f:
        while True:
            data = get(params)
            if n == 0:
                print("total", data.get("totalCount"), flush=True)
            for s in data.get("studies", []):
                f.write(json.dumps(compact(s), separators=(",", ":")) + "\n")
                n += 1
            tok = data.get("nextPageToken")
            if n % 50000 < 1000:
                print("fetched", n, flush=True)
            if not tok:
                break
            params["pageToken"] = tok
    print("done", n, flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
