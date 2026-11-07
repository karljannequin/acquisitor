"""Prépare les comptages d'ACQUISITOR à partir de la base officielle des entreprises (fichiers publics de l'INSEE).

Entrée (dossier passé en argument) : etab.parquet (StockEtablissement), ul.parquet (StockUniteLegale),
communes.json, arr.json, deps.json, regs.json (découpage géographique officiel).
Sortie : sortie.json = liste {key, value} prête à envoyer dans le stockage Cloudflare (KV « acquisitor-donnees »).

  c:<code NAF>  -> {commune: [sans salarié ou inconnu, 1-2, 3-5, 6-9, 10-19, 20-49, 50 et plus]}  établissements actifs
  r:<métier>:<code NAF> -> idem, pour les métiers repérés par leur nom (pizzerias…), séparés par code
  geo           -> {commune: [lat, lon, département, région]}
  lieux         -> liste pour la saisie : [type, code, nom, sous-titre, population]
  maj           -> date des fichiers
"""
import json, re, sys, os, duckdb

D = sys.argv[1]
sys.path.insert(0, os.path.dirname(__file__))
CAT = json.load(open(os.path.join(os.path.dirname(__file__), "catalogue.json")))
items = [i for f in CAT for i in f["items"]]
naf_codes = sorted({c for i in items if not i.get("re") for c in i["naf"].split(",")})
re_items = [i for i in items if i.get("re")]
re_naf = sorted({c for i in re_items for c in i["naf"].split(",")})

con = duckdb.connect()
con.execute("PRAGMA threads=4")
con.execute(f"CREATE VIEW e AS SELECT * FROM read_parquet('{D}/etab.parquet')")
G = """CASE WHEN trancheEffectifsEtablissement IN ('01') THEN 1
            WHEN trancheEffectifsEtablissement IN ('02') THEN 2
            WHEN trancheEffectifsEtablissement IN ('03') THEN 3
            WHEN trancheEffectifsEtablissement IN ('11') THEN 4
            WHEN trancheEffectifsEtablissement IN ('12') THEN 5
            WHEN trancheEffectifsEtablissement IN ('21','22','31','32','41','42','51','52','53') THEN 6
            ELSE 0 END"""
BASE = "etatAdministratifEtablissement='A' AND codeCommuneEtablissement IS NOT NULL AND nomenclatureActivitePrincipaleEtablissement='NAFRev2'"

out = {}
def add(key, com, g, n):
    d = out.setdefault(key, {})
    a = d.setdefault(com, [0, 0, 0, 0, 0, 0, 0])
    a[g] += n

codes_sql = ",".join("'" + c + "'" for c in naf_codes)
for naf, com, g, n in con.execute(f"""SELECT activitePrincipaleEtablissement, codeCommuneEtablissement, {G} g, count(*)
    FROM e WHERE {BASE} AND activitePrincipaleEtablissement IN ({codes_sql}) GROUP BY ALL""").fetchall():
    add("c:" + naf, com, g, n)

# Métiers sans code officiel : nom ou enseigne de l'établissement, et nom de l'entreprise
con.execute(f"CREATE VIEW u AS SELECT siren, denominationUniteLegale, denominationUsuelle1UniteLegale, denominationUsuelle2UniteLegale, denominationUsuelle3UniteLegale, sigleUniteLegale FROM read_parquet('{D}/ul.parquet')")
rn = ",".join("'" + c + "'" for c in re_naf)
rows = con.execute(f"""SELECT e.codeCommuneEtablissement, {G} g, e.activitePrincipaleEtablissement naf,
    lower(concat_ws(' ', e.enseigne1Etablissement, e.enseigne2Etablissement, e.enseigne3Etablissement, e.denominationUsuelleEtablissement,
                    u.denominationUniteLegale, u.denominationUsuelle1UniteLegale, u.denominationUsuelle2UniteLegale, u.denominationUsuelle3UniteLegale, u.sigleUniteLegale)) nom
    FROM e LEFT JOIN u USING (siren)
    WHERE {BASE} AND e.activitePrincipaleEtablissement IN ({rn})""").fetchall()
pats = [(i["id"], re.compile(i["re"], re.I)) for i in re_items]
for com, g, naf, nom in rows:
    for iid, p in pats:
        if nom and p.search(nom):
            add("r:" + iid + ":" + naf, com, g, 1)

# Géographie
geo, lieux = {}, []
deps = {d["code"]: d for d in json.load(open(f"{D}/deps.json"))}
regs = {r["code"]: r for r in json.load(open(f"{D}/regs.json"))}
for f in ("communes", "arr"):
    for c in json.load(open(f"{D}/{f}.json")):
        if not c.get("centre"):
            continue
        lon, lat = c["centre"]["coordinates"]
        geo[c["code"]] = [round(lat, 4), round(lon, 4), c.get("codeDepartement"), c.get("codeRegion")]
        if f == "communes":
            lieux.append(["com", c["code"], c["nom"], c.get("codeDepartement") or "", c.get("population") or 0])
for d in deps.values():
    lieux.append(["dep", d["code"], d["nom"], "département " + d["code"], 10**8])
for r in regs.values():
    lieux.append(["reg", r["code"], r["nom"], "région", 10**9])

kv = [{"key": k, "value": json.dumps(v, separators=(",", ":"))} for k, v in out.items()]
kv.append({"key": "geo", "value": json.dumps(geo, separators=(",", ":"))})
kv.append({"key": "lieux", "value": json.dumps(lieux, separators=(",", ":"), ensure_ascii=False)})
kv.append({"key": "maj", "value": sys.argv[2] if len(sys.argv) > 2 else ""})
json.dump(kv, open(f"{D}/sortie.json", "w"), ensure_ascii=False)
tot = {k: sum(sum(a) for a in v.values()) for k, v in out.items()}
print(len(kv), "clés ;", "taille", sum(len(x["value"]) for x in kv) // 1024, "Ko")
for k in sorted(tot)[:200]:
    print(k, tot[k])
