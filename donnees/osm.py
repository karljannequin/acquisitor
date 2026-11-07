"""Copie, département par département, des lieux qui ont un site internet sur la carte libre OpenStreetMap
(données © les contributeurs OpenStreetMap, licence ODbL). Le détective lit cette copie au lieu d'interroger la carte en direct.
Usage : python3 osm.py <dossier de sortie> [départements...]   -> <dossier>/osm_<dep>.json
"""
import json, sys, os, time, urllib.request, urllib.parse
OUT = sys.argv[1]
SERVEURS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
DEPS = sys.argv[2:] or [f"{i:02d}" for i in range(1, 96) if i != 20] + ["2A", "2B", "971", "972", "973", "974", "976"]
CLES = ["name", "website", "contact:website", "url", "email", "contact:email", "amenity", "shop", "craft", "office", "tourism", "healthcare", "leisure", "cuisine", "addr:postcode"]
for d in DEPS:
    f = f"{OUT}/osm_{d}.json"
    if os.path.exists(f):
        continue
    q = f'[out:json][timeout:180];area["ISO3166-2"="FR-{d}"]->.a;nwr(area.a)["name"][~"^(website|contact:website|url)$"~"."];out center tags;'
    for essai in range(9):
        u = SERVEURS[essai % len(SERVEURS)]
        try:
            req = urllib.request.Request(u, data=urllib.parse.urlencode({"data": q}).encode(), headers={"user-agent": "ACQUISITOR (+https://acquisitor.fr)"})
            j = json.load(urllib.request.urlopen(req, timeout=240))
            out = []
            for x in j.get("elements", []):
                t = x.get("tags", {})
                lat = x.get("lat") or (x.get("center") or {}).get("lat"); lon = x.get("lon") or (x.get("center") or {}).get("lon")
                if lat is None: continue
                out.append([round(lat, 5), round(lon, 5)] + [t.get(k, "") for k in CLES])
            if not out and essai < 8:
                raise Exception("vide")
            json.dump(out, open(f, "w"), ensure_ascii=False)
            print(d, len(out), u.split("/")[2], flush=True)
            break
        except Exception as e:
            print(d, "erreur", u.split("/")[2], str(e)[:80], flush=True); time.sleep(10)
    time.sleep(2)
