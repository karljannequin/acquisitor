"""Comptages d'ACQUISITOR pour TOUS les métiers (732 codes NAF) et tous les types d'organismes,
établissements actifs ET diffusables seulement (ceux qui ont refusé la diffusion sont retirés).
Sortie : comptes.json = [{key, value}] pour la table D1 « comptes ».
  c:<NAF>            {commune: [inconnu, 1-2, 3-5, 6-9, 10-19, 20-49, 50+]}
  r:<métier>:<NAF>   idem, métiers repérés par leur nom (pizzerias…)
  j:<org>            idem, type d'organisme (siège seulement : une fiche par organisme)
  j:<org>:<NAF>      idem, par activité (pour ne pas compter deux fois avec un métier choisi)
  jn                 {org: [codes NAF présents]}
"""
import json, re, sys, os, duckdb
D = sys.argv[1]; H = os.path.dirname(os.path.abspath(__file__))
CAT = json.load(open(f"{H}/catalogue.json")); ORGS = json.load(open(f"{H}/orgs.json"))
re_items = [i for f in CAT for i in f["items"] if i.get("re")]
re_naf = sorted({c for i in re_items for c in i["naf"].split(",")})
cj2org = {int(c): o["id"] for o in ORGS for c in o["cj"]}
con = duckdb.connect(); con.execute("PRAGMA threads=4")
con.execute(f"CREATE VIEW e AS SELECT * FROM read_parquet('{D}/etab.parquet') WHERE etatAdministratifEtablissement='A' AND statutDiffusionEtablissement='O' AND codeCommuneEtablissement IS NOT NULL AND nomenclatureActivitePrincipaleEtablissement='NAFRev2'")
con.execute(f"CREATE VIEW u AS SELECT * FROM read_parquet('{D}/ul.parquet')")
G = """CASE trancheEffectifsEtablissement WHEN '01' THEN 1 WHEN '02' THEN 2 WHEN '03' THEN 3 WHEN '11' THEN 4 WHEN '12' THEN 5
  WHEN '21' THEN 6 WHEN '22' THEN 6 WHEN '31' THEN 6 WHEN '32' THEN 6 WHEN '41' THEN 6 WHEN '42' THEN 6 WHEN '51' THEN 6 WHEN '52' THEN 6 WHEN '53' THEN 6 ELSE 0 END"""
out = {}
def add(k, com, g, n):
    a = out.setdefault(k, {}).setdefault(com, [0] * 7); a[g] += n
for naf, com, g, n in con.execute(f"SELECT activitePrincipaleEtablissement, codeCommuneEtablissement, {G}, count(*) FROM e GROUP BY ALL").fetchall():
    add("c:" + naf, com, g, n)
rn = ",".join("'" + c + "'" for c in re_naf)
pats = [(i["id"], re.compile(i["re"], re.I)) for i in re_items]
for com, g, naf, nom in con.execute(f"""SELECT e.codeCommuneEtablissement, {G}, e.activitePrincipaleEtablissement,
    lower(concat_ws(' ', e.enseigne1Etablissement, e.enseigne2Etablissement, e.enseigne3Etablissement, e.denominationUsuelleEtablissement,
      u.denominationUniteLegale, u.denominationUsuelle1UniteLegale, u.denominationUsuelle2UniteLegale, u.denominationUsuelle3UniteLegale, u.sigleUniteLegale))
    FROM e LEFT JOIN u USING (siren) WHERE e.activitePrincipaleEtablissement IN ({rn})""").fetchall():
    for iid, p in pats:
        if nom and p.search(nom): add("r:" + iid + ":" + naf, com, g, 1)
cjs = ",".join(str(c) for c in cj2org)
jn = {}
for cj, naf, com, g, n in con.execute(f"""SELECT u.categorieJuridiqueUniteLegale, e.activitePrincipaleEtablissement, e.codeCommuneEtablissement, {G}, count(*)
    FROM e JOIN u USING (siren) WHERE u.categorieJuridiqueUniteLegale IN ({cjs}) AND e.etablissementSiege GROUP BY ALL""").fetchall():
    o = cj2org[int(cj)]
    add("j:" + o, com, g, n); add("j:" + o + ":" + naf, com, g, n); jn.setdefault(o, set()).add(naf)
kv = [{"key": k, "value": json.dumps(v, separators=(",", ":"))} for k, v in out.items()]
kv.append({"key": "jn", "value": json.dumps({o: sorted(s) for o, s in jn.items()})})
tot = sum(sum(a) for k, v in out.items() if k.startswith("c:") for a in v.values())
kv.append({"key": "stats", "value": json.dumps({"etablissements": tot, "metiers": 732, "organismes": len(ORGS)})})
json.dump(kv, open(f"{D}/comptes.json", "w"))
print(len(kv), "clés,", sum(len(x["value"]) for x in kv) // 1048576, "Mo, plus grosse", max(len(x["value"]) for x in kv) // 1024, "Ko ; établissements utilisables :", tot)
for o in ORGS: print(o["id"], sum(sum(a) for a in out.get("j:" + o["id"], {}).values()))
