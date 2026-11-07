// Vitrine ACQUISITOR (acquisitor.fr)
// - "/"              : la page d'accueil
// - "/api/estimation": combien d'entreprises correspondent à une phrase (registre officiel, gratuit)
// - "/api/liste"     : inscription à la liste d'attente (KV LISTE)
import PAGE from "./index.html";

const JSON_H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: JSON_H });
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");

// Activités courantes -> codes d'activité officiels (NAF)
const ACTS = [
  [["coiff"], "Coiffeurs", "96.02A"],
  [["esthetic", "institut de beaute", "beaute", "onglerie"], "Instituts de beauté", "96.02B"],
  [["pizz"], "Pizzerias et restaurants rapides", "56.10C"],
  [["restaurant", "resto"], "Restaurants", "56.10A"],
  [["boulang"], "Boulangeries", "10.71C"],
  [["patiss"], "Pâtisseries", "10.71D"],
  [["boucher", "charcut"], "Boucheries", "47.22Z"],
  [["fleur"], "Fleuristes", "47.76Z"],
  [["garage", "mecani", "carross"], "Garages", "45.20A"],
  [["hotel"], "Hôtels", "55.10Z"],
  [["camping"], "Campings", "55.30Z"],
  [["gite", "chambre d hote", "hebergement"], "Hébergements touristiques", "55.20Z"],
  [["immobili", "immo "], "Agences immobilières", "68.31Z"],
  [["plomb", "chauffag"], "Plombiers chauffagistes", "43.22A"],
  [["electricien"], "Électriciens", "43.21A"],
  [["macon"], "Maçons", "43.99C"],
  [["menuisi"], "Menuisiers", "43.32A"],
  [["peintre"], "Peintres en bâtiment", "43.34Z"],
  [["opticien"], "Opticiens", "47.78A"],
  [["pharmac"], "Pharmacies", "47.73Z"],
  [["dentist"], "Dentistes", "86.23Z"],
  [["medecin", "generaliste"], "Médecins", "86.21Z"],
  [["kine"], "Kinésithérapeutes", "86.90E"],
  [["avocat"], "Avocats", "69.10Z"],
  [["comptab"], "Experts-comptables", "69.20Z"],
  [["architect"], "Architectes", "71.11Z"],
  [["assuran"], "Agents d'assurance", "66.22Z"],
  [["salle de sport", "fitness", "sport"], "Salles de sport", "93.13Z"],
  [["bar ", "bars", "cafe"], "Bars et cafés", "56.30Z"],
  [["tabac"], "Bureaux de tabac", "47.26Z"],
  [["vetement", "boutique", "pret a porter", "mode"], "Boutiques de vêtements", "47.71Z"],
  [["epicerie", "superette"], "Épiceries", "47.11B"],
  [["taxi"], "Taxis", "49.32Z"],
  [["nettoyage", "menage"], "Entreprises de nettoyage", "81.21Z"],
  [["informatique", "developpeur", "logiciel"], "Entreprises informatiques", "62.02A"],
  [["traiteur"], "Traiteurs", "56.21Z"],
  [["creche"], "Crèches", "88.91A"],
  [["ehpad", "maison de retraite"], "Maisons de retraite", "87.10A"],
  [["aide a domicile", "service a la personne", "services a la personne"], "Aide à domicile", "88.10A"],
  [["transport"], "Transporteurs", "49.41A"],
  [["ecole"], "Écoles", "85.20Z"],
];
// Tranches de salariés du registre : [minimum, code]
const TRANCHES = [[1, "01"], [3, "02"], [6, "03"], [10, "11"], [20, "12"], [50, "21"], [100, "22"], [200, "31"], [250, "32"], [500, "41"], [1000, "42"], [2000, "51"], [5000, "52"], [10000, "53"]];

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!r.ok) throw new Error("source " + r.status);
  return r.json();
}

async function estimate(text) {
  const t = " " + norm(text) + " ";
  const act = ACTS.find(([keys]) => keys.some((k) => t.includes(k)));
  const km = +((t.match(/(\d+)\s*km/) || t.match(/\+\s*(\d+)/) || [])[1] || 0);
  const sal = +((t.match(/(\d+)\s*salari/) || [])[1] || 0);
  const notes = [];

  // Zone : département, région ou ville
  let zone = null;
  const depM = t.match(/\b(\d{2}|2a|2b)\b(?!\s*(km|salari))/);
  const after = (t.match(/(?:autour de|pres de|proche de|a cote de|dans le|dans la|dans les|en|sur|a|de)\s+([a-z\- ]{3,40}?)(?:\s+\d|\s+plus|\s+avec|\s+et\s|\s*$)/g) || []).map((s) => s.replace(/^(autour de|pres de|proche de|a cote de|dans le|dans la|dans les|en|sur|a|de)\s+/, "").trim()).filter((s) => s && !ACTS.some(([keys]) => keys.some((k) => s.includes(k.trim()))));
  for (const cand of after.reverse()) {
    const name = cand.replace(/\b(salaries?|km|plus|moins)\b.*$/, "").trim();
    if (name.length < 3) continue;
    const deps = await getJson(`https://geo.api.gouv.fr/departements?nom=${encodeURIComponent(name)}&fields=nom,code&limit=1`).catch(() => []);
    if (deps[0] && norm(deps[0].nom) === name) { zone = { type: "dep", code: deps[0].code, label: deps[0].nom }; break; }
    const regs = await getJson(`https://geo.api.gouv.fr/regions?nom=${encodeURIComponent(name)}&fields=nom,code&limit=1`).catch(() => []);
    if (regs[0] && norm(regs[0].nom) === name) { zone = { type: "reg", code: regs[0].code, label: regs[0].nom }; break; }
    const com = await getJson(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(name)}&fields=nom,code,centre,codeDepartement&boost=population&limit=1`).catch(() => []);
    if (com[0]) { zone = { type: "com", code: com[0].code, label: com[0].nom, dep: com[0].codeDepartement, centre: com[0].centre && com[0].centre.coordinates }; break; }
  }
  if (!zone && depM) zone = { type: "dep", code: depM[1].toUpperCase(), label: "département " + depM[1].toUpperCase() };

  const p = new URLSearchParams({ per_page: "1", etat_administratif: "A" });
  if (act) p.set("activite_principale", act[2]);
  else {
    const words = t.replace(/\b(je|cherche|chercher|les|des|du|de|la|le|a|au|aux|dans|autour|pres|km|plus|moins|salaries?|entreprises?|clients?|et|en|sur|qui|ont|avec)\b/g, " ").replace(/\d+/g, " ").trim().split(/\s+/).filter((w) => w.length > 3);
    if (!words.length) return { ok: false, message: "Précisez le type d’entreprise, par exemple « coiffeurs » ou « garages »." };
    p.set("q", words[0]);
    notes.push("Activité estimée d’après le nom des entreprises.");
  }
  if (sal > 0) {
    const codes = TRANCHES.filter(([min]) => min >= sal).map(([, c]) => c);
    if (codes.length) p.set("tranche_effectif_salarie", codes.join(","));
  }
  let url = "https://recherche-entreprises.api.gouv.fr/search?";
  let zoneLabel = "toute la France";
  if (zone && zone.type === "com" && km > 0 && zone.centre) {
    const r = Math.min(km, 50);
    if (km > 50) notes.push("Rayon limité à 50 km pour l’estimation.");
    url = "https://recherche-entreprises.api.gouv.fr/near_point?";
    p.set("long", String(zone.centre[0])); p.set("lat", String(zone.centre[1])); p.set("radius", String(r));
    zoneLabel = `${zone.label} + ${r} km`;
  } else if (zone && zone.type === "com") { p.set("code_commune", zone.code); zoneLabel = zone.label; }
  else if (zone && zone.type === "dep") { p.set("departement", zone.code); zoneLabel = zone.label; }
  else if (zone && zone.type === "reg") { p.set("region", zone.code); zoneLabel = zone.label; }

  const d = await getJson(url + p.toString());
  return {
    ok: true,
    total: d.total_results || 0,
    activite: act ? act[1] : null,
    zone: zoneLabel,
    salaries: sal > 0 ? `plus de ${sal} salariés` : null,
    notes,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.acquisitor.fr") { url.hostname = "acquisitor.fr"; return Response.redirect(url.toString(), 301); }

    if (url.pathname === "/api/estimation" && request.method === "GET") {
      const q = (url.searchParams.get("q") || "").slice(0, 200);
      if (q.trim().length < 3) return json({ ok: false, message: "Décrivez les clients que vous cherchez." }, 400);
      try { return json(await estimate(q)); }
      catch (e) { return json({ ok: false, message: "Le registre des entreprises ne répond pas pour le moment. Réessayez dans un instant." }, 502); }
    }

    if (url.pathname === "/api/liste" && request.method === "POST") {
      let b = {};
      try { b = await request.json(); } catch {}
      if (b.site) return json({ ok: true }); // champ piège anti-robots
      const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, message: "Adresse e-mail invalide." }, 400);
      const rec = { email, besoin: String(b.besoin || "").slice(0, 300), date: new Date().toISOString(), pays: request.cf && request.cf.country || "" };
      await env.LISTE.put("liste:" + email, JSON.stringify(rec));
      return json({ ok: true });
    }

    if (url.pathname !== "/") return Response.redirect(url.origin + "/", 302);
    return new Response(PAGE, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  },
};
