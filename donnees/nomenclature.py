"""Génère vitrine/src/nomenclature.js : les 732 métiers officiels (NAF rév. 2, rangés par grande famille)
et les types d'organismes publics et associations (regroupements de catégories juridiques de l'INSEE)."""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
naf = json.load(open(f"{H}/naf.json"))
SECTIONS = [("A", "Agriculture, sylviculture et pêche", 1, 3), ("B", "Industries extractives", 5, 9), ("C", "Industrie manufacturière", 10, 33),
 ("D", "Électricité, gaz, vapeur et air conditionné", 35, 35), ("E", "Eau, assainissement, gestion des déchets et dépollution", 36, 39), ("F", "Construction", 41, 43),
 ("G", "Commerce, réparation d'automobiles et de motocycles", 45, 47), ("H", "Transports et entreposage", 49, 53), ("I", "Hébergement et restauration", 55, 56),
 ("J", "Information et communication", 58, 63), ("K", "Activités financières et d'assurance", 64, 66), ("L", "Activités immobilières", 68, 68),
 ("M", "Activités spécialisées, scientifiques et techniques", 69, 75), ("N", "Services administratifs et de soutien", 77, 82), ("O", "Administration publique", 84, 84),
 ("P", "Enseignement", 85, 85), ("Q", "Santé humaine et action sociale", 86, 88), ("R", "Arts, spectacles et activités récréatives", 90, 93),
 ("S", "Autres activités de services", 94, 96), ("T", "Activités des ménages en tant qu'employeurs", 97, 98), ("U", "Activités extra-territoriales", 99, 99)]
lab = {x["id"]: x["label"] for x in naf}
divs = [x for x in naf if len(x["id"]) == 2]
subs = [x for x in naf if len(x["id"]) == 6]
arbre = []
for code, nom, a, b in SECTIONS:
    fam = {"s": code, "f": nom, "d": []}
    for d in divs:
        if a <= int(d["id"]) <= b:
            fam["d"].append({"d": d["id"], "l": d["label"], "items": [[s["id"], s["label"]] for s in subs if s["id"].startswith(d["id"] + ".")]})
    arbre.append(fam)
ORGS = [
 ("org-mairies", "Mairies", ["7210", "7312"], "mairie mairies commune communes municipalite"),
 ("org-intercos", "Communautés de communes, d'agglomération et métropoles", ["7346", "7348", "7343", "7344", "7340"], "communaute de communes agglomeration metropole intercommunalite"),
 ("org-syndicats-interco", "Syndicats intercommunaux et syndicats mixtes", ["7345", "7353", "7354", "7355", "7351", "7349", "7356", "7357"], "syndicat intercommunal sivom sivu syndicat mixte"),
 ("org-departements", "Conseils départementaux", ["7220"], "conseil departemental departement"),
 ("org-regions", "Régions et collectivités à statut particulier", ["7230", "7225", "7229"], "region conseil regional collectivite"),
 ("org-etat", "Ministères et administrations centrales de l'État", ["7111", "7112", "7113", "7120", "7150", "7160"], "ministere etat administration centrale"),
 ("org-prefectures", "Préfectures, rectorats et services de l'État en région et département", ["7171", "7172", "7179"], "prefecture rectorat services de l etat dreal ddt"),
 ("org-ccas", "Centres d'action sociale (CCAS, CIAS)", ["7361", "7367"], "ccas cias action sociale"),
 ("org-caisses-ecoles", "Caisses des écoles", ["7362"], "caisse des ecoles"),
 ("org-hopitaux", "Hôpitaux publics", ["7364"], "hopital hopitaux centre hospitalier chu"),
 ("org-ehpad-publics", "Maisons de retraite et EHPAD publics", ["7366"], "ehpad public maison de retraite publique"),
 ("org-colleges-lycees", "Collèges et lycées publics", ["7331"], "college lycee colleges lycees"),
 ("org-universites", "Universités et grandes écoles publiques", ["7383", "7384"], "universite ecole superieure grande ecole"),
 ("org-pompiers", "Pompiers (SDIS)", ["7372"], "pompiers sdis incendie secours"),
 ("org-chambres", "Chambres de commerce et chambres de métiers", ["7381"], "cci chambre de commerce chambre des metiers cma"),
 ("org-etablissements-publics", "Autres établissements publics (agences, offices de tourisme, musées…)", ["7385", "7389", "7379", "7378", "7373", "7410", "7470", "7490", "4110", "4120", "4140", "4150"], "etablissement public office de tourisme agence regionale musee"),
 ("org-secu", "Sécurité sociale, caisses de retraite et mutuelles", ["8110", "8120", "8130", "8140", "8150", "8160", "8170", "8190", "8210", "8250", "8290", "8510", "8520"], "securite sociale caf cpam msa urssaf caisse de retraite mutuelle"),
 ("org-cse", "Comités d'entreprise (CSE)", ["8310", "8311"], "cse comite d entreprise comite social"),
 ("org-syndicats-pro", "Syndicats, fédérations et ordres professionnels", ["8400", "8410", "8420", "8450", "8470", "8490"], "syndicat federation ordre professionnel"),
 ("org-associations", "Associations", ["9210", "9220", "9221", "9222", "9230", "9260"], "association associations asso club"),
 ("org-groupements-employeurs", "Groupements d'employeurs", ["9223"], "groupement d employeurs"),
 ("org-fondations", "Fondations et fonds de dotation", ["9300"], "fondation fonds de dotation"),
 ("org-cultes", "Congrégations et cultes", ["9240", "7430"], "congregation culte paroisse eglise"),
 ("org-coproprietes", "Syndicats de copropriété", ["9110"], "copropriete syndic de copropriete"),
 ("org-maisons-sante", "Maisons de santé pluriprofessionnelles", ["6511"], "maison de sante msp"),
 ("org-coop-agricoles", "Coopératives agricoles et CUMA", ["6316", "6317", "6318"], "cooperative agricole cuma"),
]
orgs = [{"id": i, "l": l, "cj": cj, "k": k.split(" ")} for i, l, cj, k in ORGS]
json.dump(orgs, open(f"{H}/orgs.json", "w"), ensure_ascii=False, indent=0)
js = "// Généré par donnees/nomenclature.py : ne pas modifier à la main.\n"
js += "// NAF : les 732 métiers officiels (nomenclature d'activités française, INSEE), par grande famille.\n"
js += "export const NAF = " + json.dumps(arbre, ensure_ascii=False, separators=(",", ":")) + ";\n"
js += "// ORGS : organismes publics et associations, par type (catégories juridiques INSEE).\n"
js += "export const ORGS = " + json.dumps(orgs, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(f"{H}/../vitrine/src/nomenclature.js", "w").write(js)
print(len(subs), "métiers,", len(divs), "familles,", len(orgs), "types d'organismes ;", len(js) // 1024, "Ko")
