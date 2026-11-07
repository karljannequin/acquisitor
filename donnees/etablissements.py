"""Liste des établissements ciblés (métiers du catalogue), rangée par commune, pour vérifier les contacts trouvés.

Sortie : etab_kv.json = [{key: "e:<commune>", value: [[siret, nom, enseigne, naf, code postal, adresse, tranche], ...]}]
tranche : 0 inconnu, 1 = 1-2, 2 = 3-5, 3 = 6-9, 4 = 10-19, 5 = 20-49, 6 = 50+
"""
import json, sys, os, duckdb
D = sys.argv[1]
CAT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalogue.json")))
codes = sorted({c for f in CAT for i in f["items"] for c in i["naf"].split(",")})
con = duckdb.connect(); con.execute("PRAGMA threads=4")
rows = con.execute(f"""
SELECT e.codeCommuneEtablissement com, e.siret,
  coalesce(u.denominationUniteLegale, trim(coalesce(u.prenom1UniteLegale,'')||' '||coalesce(u.nomUsageUniteLegale,u.nomUniteLegale,''))) nom,
  trim(concat_ws(' ', e.enseigne1Etablissement, e.denominationUsuelleEtablissement)) ens,
  e.activitePrincipaleEtablissement naf, e.codePostalEtablissement cp,
  trim(concat_ws(' ', e.numeroVoieEtablissement, e.typeVoieEtablissement, e.libelleVoieEtablissement)) adr,
  CASE e.trancheEffectifsEtablissement WHEN '01' THEN 1 WHEN '02' THEN 2 WHEN '03' THEN 3 WHEN '11' THEN 4 WHEN '12' THEN 5
    WHEN '21' THEN 6 WHEN '22' THEN 6 WHEN '31' THEN 6 WHEN '32' THEN 6 WHEN '41' THEN 6 WHEN '42' THEN 6 WHEN '51' THEN 6 WHEN '52' THEN 6 WHEN '53' THEN 6 ELSE 0 END t
FROM read_parquet('{D}/etab.parquet') e LEFT JOIN read_parquet('{D}/ul.parquet') u USING (siren)
WHERE e.etatAdministratifEtablissement='A' AND e.codeCommuneEtablissement IS NOT NULL
  AND e.activitePrincipaleEtablissement IN ({','.join(repr(c) for c in codes)})""").fetchall()
by = {}
for com, *r in rows:
    by.setdefault(com, []).append([x if x != "" else None for x in r])
kv = [{"key": "e:" + c, "value": json.dumps(v, separators=(",", ":"), ensure_ascii=False)} for c, v in by.items()]
json.dump(kv, open(f"{D}/etab_kv.json", "w"), ensure_ascii=False)
print(len(rows), "établissements,", len(kv), "communes, plus gros :", max(len(x["value"]) for x in kv) // 1024, "Ko, total", sum(len(x["value"]) for x in kv) // 1048576, "Mo")
