// Le détective ACQUISITOR : trouve des contacts d'entreprises et ne garde que ceux dont il est sûr.
//
// Une enquête = une recherche (métiers + ville + rayon + taille).
//  1. start : liste les établissements qui ont un site internet dans la zone (carte libre OpenStreetMap)
//     et les relie au registre officiel (même nom, commune voisine, bon métier, en activité).
//  2. step  : lit les sites, petit lot par petit lot (le navigateur relance jusqu'à la fin).
//     Un contact est gardé seulement si :
//       - le site affiche le numéro officiel (SIREN) de l'entreprise  -> preuve « SIREN »
//       - ou le site affiche le nom ET le code postal de l'établissement -> preuve « nom + adresse »
//       - et l'adresse e-mail est sur le site, appartient au site (ou messagerie classique) et peut recevoir du courrier.
//  Les contacts gardés vont dans la base (D1 « acquisitor-base ») et y restent pour les prochaines enquêtes.

import { METIERS } from "./catalogue.js";

// ---------- RÈGLE ABSOLUE : exclusions permanentes (non désactivable) ----------
// Domino's Pizza Vendôme, la société RYD, Malek Hassani / Hassanni et toutes ses sociétés.
const EXCLUS_SIREN = new Set([
  "824407639", // RYD (Vendôme)
  "824548721", "808968044", "841718356", "508300597", "977642446", "919795344",
  "918910084", "922563457", "888208600", "902149046", "824167977", "820584316", // sociétés dirigées par Malek Hassani
]);
export function exclu(e) {
  // e = { siret, nom, ens, cp, email, site }
  if (e.siret && EXCLUS_SIREN.has(String(e.siret).slice(0, 9))) return true;
  const t = norm([e.nom, e.ens, e.email, e.site].filter(Boolean).join(" "));
  if (/\bhass?ann?i\b/.test(t) && /\bmalek\b/.test(t)) return true;
  if (/\bryd\b/.test(t) && String(e.cp || "").startsWith("41")) return true;
  if (/domino/.test(t) && (e.cp === "41100" || String(e.commune || "") === "41269")) return true;
  return false;
}

// Catégories de la carte qui correspondent à chaque code d'activité
const HINTS = {
  "56.10A": /restaurant|fast_food|cafe|pizza|kebab|burger|sushi|japanese|crepe|creperie/, "56.10C": /fast_food|restaurant|pizza|kebab|burger|sushi/, "56.21Z": /caterer|deli/, "56.30Z": /\bbar\b|pub|cafe|biergarten/,
  "10.71C": /bakery/, "10.71D": /pastry|confectionery|bakery/, "47.22Z": /butcher/, "47.76Z": /florist/, "47.11B": /convenience|supermarket|greengrocer/, "47.11C": /convenience|supermarket/,
  "47.71Z": /clothes|boutique|fashion/, "47.72A": /shoes/, "47.77Z": /jewelry|watches/, "47.78A": /optician/, "47.73Z": /pharmacy/, "47.26Z": /tobacco/, "47.61Z": /books/, "47.64Z": /sports|outdoor|bicycle/, "47.25Z": /wine|alcohol|beverages/,
  "96.02A": /hairdresser|barber/, "96.02B": /beauty|cosmetics|nail/, "93.13Z": /fitness/, "96.04Z": /spa|massage|sauna/,
  "45.20A": /car_repair|tyres|car_parts/, "45.11Z": /\bcar\b|car_dealer/, "71.20A": /vehicle_inspection|car_repair/, "85.53Z": /driving_school/, "49.32Z": /taxi/,
  "43.22A": /plumber|hvac|heating/, "43.21A": /electrician/, "43.99C": /builder|stonemason/, "43.32A": /carpenter|joiner|window/, "43.34Z": /painter|decorator/, "43.91B": /roofer/, "43.33Z": /tiler|floorer/, "81.30Z": /gardener|landscap/, "71.11Z": /architect/,
  "86.21Z": /doctor|clinic/, "86.23Z": /dentist/, "86.90E": /physiotherapist/, "86.90D": /nurse/, "75.00Z": /veterinary/, "86.90B": /laboratory/,
  "68.31Z": /estate_agent/, "68.32A": /estate_agent|property/, "55.10Z": /hotel|motel/, "55.20Z": /guest_house|chalet|apartment|hostel/, "55.30Z": /camp_site|caravan/, "79.11Z": /travel_agen/,
  "69.20Z": /accountant|tax_advisor/, "69.10Z": /lawyer|notary/, "73.11Z": /advertising|marketing/, "62.02A": /\bit\b|computer/, "81.21Z": /cleaning/, "66.22Z": /insurance/, "70.22Z": /consulting/, "80.10Z": /security/, "18.12Z": /printing|copyshop/,
  "88.10A": /social_facility/, "88.91A": /kindergarten|childcare/, "87.10A": /nursing_home|social_facility/, "96.03Z": /funeral/, "85.20Z": /school/, "85.31Z": /school/, "85.59A": /training|school/,
};

let DIAG = false;
export const diag = (v) => { DIAG = !!v; };
const VENDOME = [47.7929, 1.0656];
// Sites nationaux de chaînes : pas le contact de l'établissement
const CHAINES = /(^|\.)(mcdonalds|buffalo-grill|dominos|kfc|burgerking|subway|quick|pizzahut|lacrigrill|courtepaille|hippopotamus|leon-de-bruxelles|flunch|o-tacos|otacos|bagelstein|starbucks|paul|marie-blachere|ange|feuillette|carrefour|leclerc|e-leclerc|intermarche|auchan|lidl|aldi|casino|franprix|monoprix|super-u|magasins-u|netto|spar|norauto|midas|speedy|feuvert|point-s|euromaster|vulco|jeanlouisdavid|franckprovost|dessange|tchip|saint-algue|basic-fit|keepcool|orangebleue|fitnesspark|afflelou|optic2000|krys|generale-optique|atol|grandoptical|century21|laforet|orpi|guy-hoquet|stephaneplazaimmobilier|era|ibis|accor|all|campanile|kyriad|b-and-b-hotels|hotel-bb|premiereclasse|logishotels|bestwestern|axa|allianz|groupama|maaf|macif|mma|gan|credit-agricole|ca-|banquepopulaire|societegenerale|bnpparibas|lcl|cic|creditmutuel|laposte|sncf)\.(fr|com|eu)$/;

const UA = "ACQUISITOR-detective/1.0 (+https://acquisitor.fr/mentions-legales)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const LIBRES = /^(gmail\.com|googlemail\.com|orange\.fr|wanadoo\.fr|free\.fr|sfr\.fr|neuf\.fr|hotmail\.(fr|com)|outlook\.(fr|com)|live\.(fr|com)|yahoo\.(fr|com)|laposte\.net|bbox\.fr|aliceadsl\.fr|icloud\.com|me\.com|gmx\.fr|numericable\.fr)$/;
const GENERIQUES = new Set("sarl sas sasu eurl sa snc sci ets etablissements etablissement societe ste cie groupe le la les l de du des d et a au aux en chez the and restaurant restaurants resto pizzeria pizzerias pizza pizzas garage garages coiffure coiffeur coiffeuse salon boulangerie patisserie boulanger bar cafe brasserie hotel cabinet agence auto automobile automobiles services service maison atelier institut beaute pharmacie centre france fr com www".split(" "));

export const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const mots = (t) => norm(t).split(" ").filter((w) => w.length >= 3 && !GENERIQUES.has(w));

function dist(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const d = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(d));
}
const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

async function timed(url, opts = {}, ms = 7000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms), headers: { "user-agent": UA, accept: "text/html,*/*", ...(opts.headers || {}) }, redirect: "follow" });
}
async function texte(url, max = 400000) {
  try {
    const r = await timed(url);
    if (!r.ok || !/text|html|xml/.test(r.headers.get("content-type") || "text/html")) return null;
    const t = await r.text();
    return { url: r.url || url, html: t.slice(0, max) };
  } catch { return null; }
}

// ---------- Étape 1 : préparer l'enquête ----------
export async function demarrer(env, kv, sel) {
  const acts = (sel.acts || []).filter((id) => METIERS[id]).slice(0, 10);
  if (!acts.length) return { ok: false, message: "Choisissez au moins un métier." };
  if (!sel.lieu || sel.lieu.type !== "com") return { ok: false, message: "Pour lancer l'enquête en direct, choisissez une ville (avec un rayon autour)." };
  const geo = await kv("geo");
  const centre = geo && geo[sel.lieu.code];
  if (!centre) return { ok: false, message: "Ville inconnue." };
  const km = Math.max(1, Math.min(30, +sel.km || 10));
  const g = { toutes: 0, "1+": 1, "3+": 2, "6+": 3, "10+": 4, "20+": 5, "50+": 6 }[sel.taille] || 0;
  const naf = new Set(acts.flatMap((id) => METIERS[id].naf.split(",")));
  const res = acts.filter((id) => METIERS[id].re).map((id) => new RegExp(METIERS[id].re, "i"));
  const libres = acts.some((id) => !METIERS[id].re);
  const nafLibres = new Set(acts.filter((id) => !METIERS[id].re).flatMap((id) => METIERS[id].naf.split(",")));
  const cible = (e) => naf.has(e[3]) && (e[6] || 0) >= g && (nafLibres.has(e[3]) || res.some((r) => r.test((e[1] || "") + " " + (e[2] || ""))));

  // Communes de la zone
  const communes = [];
  for (const c in geo) { const d = dist(centre, geo[c]); if (d <= km + 3) communes.push([c, geo[c]]); }

  // Établissements ciblés de la zone (registre officiel)
  const etabs = [];
  await Promise.all(communes.map(async ([c, p]) => {
    const l = await kv("e:" + c);
    if (l) for (const e of l) if (cible(e) && !exclu({ siret: e[0], nom: e[1], ens: e[2], cp: e[4], commune: c })) etabs.push({ e, c, p });
  }));

  // Lieux avec site internet dans la zone (copie de la carte libre OpenStreetMap, par carrés)
  const cles = carres(centre, km + 3);
  const morceaux = await Promise.all(cles.map((k) => carre(env, k)));
  if (morceaux.every((m) => m === null)) return { ok: false, message: "La carte de ce secteur n'est pas encore chargée. Réessayez dans quelques minutes." };
  const osm = { elements: morceaux.filter(Boolean).flat().filter((x) => dist(centre, [x[0], x[1]]) <= km + 3).map((x) => ({ lat: x[0], lon: x[1], tags: Object.fromEntries(CLES.map((k, i) => [k, x[i + 2]]).filter((y) => y[1])) })) };
  const incomplet = morceaux.some((m) => m === null);

  // Un site partagé par plusieurs lieux = site d'une chaîne : écarté (pas le contact de l'établissement)
  const parSite = {};
  const lieux = [];
  for (const x of osm.elements || []) {
    const t = x.tags || {};
    let site = t.website || t["contact:website"] || t.url || "";
    if (!/^https?:\/\//i.test(site)) site = site ? "https://" + site.replace(/^\/+/, "") : "";
    const h = hote(site);
    if (!h || /facebook|instagram|google|pagesjaunes|tripadvisor|linktr|wix\.com$|business\.site|ubereats|deliveroo|justeat|planity|doctolib/.test(h) || CHAINES.test(h)) continue;
    const lat = x.lat ?? x.center?.lat, lon = x.lon ?? x.center?.lon;
    // Règle absolue : Domino's Vendôme, RYD, Malek Hassani écartés avant toute lecture
    if (exclu({ nom: t.name, site, cp: t["addr:postcode"] }) || (/domino/.test(norm(t.name + " " + h)) && dist([lat, lon], VENDOME) < 8)) continue;
    parSite[h] = (parSite[h] || 0) + 1;
    const cat = [t.amenity, t.shop, t.craft, t.office, t.tourism, t.healthcare, t.leisure, t.cuisine].filter(Boolean).join(" ");
    lieux.push({ nom: t.name, site, h, p: [lat, lon], email: t.email || t["contact:email"] || "", cat });
  }

  // Relier chaque lieu à un établissement du registre (nom identique, à moins de 4 km).
  // Sinon, si la carte le classe dans le bon métier, on le lit quand même : il faudra alors que son site affiche
  // le SIREN d'un établissement ciblé de la zone.
  const cands = [], pistesCarte = [];
  const vus = new Set();
  const indices = [...naf].map((c) => HINTS[c]).filter(Boolean);
  for (const l of lieux) {
    if (parSite[l.h] > 2) continue;
    const m = mots(l.nom);
    const bonneCat = indices.some((r) => r.test(l.cat));
    if (!m.length) { if (bonneCat) pistesCarte.push(l); continue; }
    let best = null;
    for (const x of etabs) {
      if (dist(l.p, x.p) > 4) continue;
      const nm = new Set(mots((x.e[2] || "") + " " + (x.e[1] || "")));
      if (m.every((w) => nm.has(w))) { const d = dist(l.p, x.p); if (!best || d < best.d) best = { x, d }; }
    }
    if (!best) { if (bonneCat) pistesCarte.push(l); continue; }
    if (vus.has(best.x.e[0])) continue;
    vus.add(best.x.e[0]);
    const e = best.x.e;
    cands.push({ siret: e[0], nom: e[1], ens: e[2], naf: e[3], cp: e[4], adr: e[5], t: e[6], commune: best.x.c, lieu: l.nom, site: l.site, email_osm: l.email });
  }

  for (const l of pistesCarte) cands.push({ siret: null, lieu: l.nom, site: l.site, email_osm: l.email });
  cands.splice(60);
  // Index des établissements ciblés de la zone, par SIREN (pour reconnaître un SIREN affiché sur un site)
  const index = {};
  for (const x of etabs) (index[x.e[0].slice(0, 9)] ||= []).push([...x.e, x.c]);

  // Déjà dans la base : résultat immédiat
  const connus = cands.filter((c) => c.siret);
  const dejaRows = connus.length ? (await env.BASE.prepare(`SELECT siret FROM contacts WHERE siret IN (${connus.map(() => "?").join(",")})`).bind(...connus.map((c) => c.siret)).all()).results : [];
  const deja = new Set(dejaRows.map((r) => r.siret));
  const id = crypto.randomUUID();
  const restants = cands.filter((c) => !deja.has(c.siret));
  await env.BASE.prepare("INSERT INTO enquetes (id, criteres, cree, candidats, pos, total_zone, deja, index_zone) VALUES (?,?,?,?,0,?,?,?)")
    .bind(id, JSON.stringify({ acts, lieu: sel.lieu, km, taille: sel.taille || "toutes" }), new Date().toISOString(), JSON.stringify(restants), etabs.length, JSON.stringify([...deja]), JSON.stringify(index)).run();
  const trouves = deja.size ? await contactsDe(env, [...deja]) : [];
  return { ok: true, id, incomplet, zone: etabs.length, sites: lieux.length, pistes: cands.length, a_lire: restants.length, trouves: trouves.map(public_) };
}

// ---------- La carte, par carrés de 0,25° (environ 25 km), gardés dans DONNEES (« o:<lat>:<lon> ») ----------
const PAS = 0.25;
export const CLES = ["name", "website", "contact:website", "url", "email", "contact:email", "amenity", "shop", "craft", "office", "tourism", "healthcare", "leisure", "cuisine", "addr:postcode"];
const cleCarre = (la, lo) => Math.floor(la / PAS) + ":" + Math.floor(lo / PAS);
function carres(c, km) {
  const dla = km / 111, dlo = km / (111 * Math.cos((c[0] * Math.PI) / 180)), out = [];
  for (let i = Math.floor((c[0] - dla) / PAS); i <= Math.floor((c[0] + dla) / PAS); i++)
    for (let j = Math.floor((c[1] - dlo) / PAS); j <= Math.floor((c[1] + dlo) / PAS); j++) out.push(i + ":" + j);
  return out;
}
export async function carre(env, k, forcer = false) {
  if (!forcer) { const v = await lireCarre(env, k); if (v) return v; }
  const [i, j] = k.split(":").map(Number);
  const bb = `${(i * PAS).toFixed(2)},${(j * PAS).toFixed(2)},${((i + 1) * PAS).toFixed(2)},${((j + 1) * PAS).toFixed(2)}`;
  const q = `[out:json][timeout:60];nwr(${bb})["name"][~"^(website|contact:website|url)$"~"."];out center tags;`;
  for (const u of OVERPASS) {
    try {
      const r = await timed(u, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" } }, 25000);
      if (!r.ok) { DERNIERE.push(hote(u) + " " + r.status); continue; }
      const j2 = await r.json();
      if (j2.remark && /timed out|error/i.test(j2.remark)) continue;
      const out = (j2.elements || []).map((x) => { const t = x.tags || {}; const la = x.lat ?? x.center?.lat, lo = x.lon ?? x.center?.lon; return la == null ? null : [+la.toFixed(5), +lo.toFixed(5), ...CLES.map((c) => t[c] || "")]; }).filter(Boolean);
      await ecrireCarre(env, k, out);
      return out;
    } catch (e) { DERNIERE.push(hote(u) + " " + (e && e.message)); }
  }
  return null;
}
const DERNIERE = [];
// Les carrés sont rangés dans la base D1 (table carte), découpés en morceaux de 700 Ko
export async function lireCarre(env, k) {
  const rows = (await env.BASE.prepare("SELECT data FROM carte WHERE cle=? ORDER BY part").bind(k).all()).results;
  if (!rows.length) return null;
  return rows.flatMap((r) => JSON.parse(r.data));
}
async function ecrireCarre(env, k, out) {
  const parts = []; let cur = [], taille = 0;
  for (const x of out) { const l = JSON.stringify(x).length; if (cur.length && taille + l > 700000) { parts.push(cur); cur = []; taille = 0; } cur.push(x); taille += l; }
  parts.push(cur);
  const maj = new Date().toISOString().slice(0, 10);
  await env.BASE.batch([env.BASE.prepare("DELETE FROM carte WHERE cle=?").bind(k), ...parts.map((p, i) => env.BASE.prepare("INSERT INTO carte (cle, part, n, maj, data) VALUES (?,?,?,?,?)").bind(k, i, p.length, maj, JSON.stringify(p)))]);
}
// Tâche de fond : charge les carrés de France qui manquent, quelques-uns à chaque passage
export async function remplirCarte(env, kv, n = 3) {
  const geo = await kv("geo"); const s = new Set();
  for (const c in geo) s.add(cleCarre(geo[c][0], geo[c][1]));
  const liste = [...s].sort();
  const faitsDeja = new Set((await env.BASE.prepare("SELECT DISTINCT cle FROM carte").all()).results.map((r) => r.cle));
  const manquants = liste.filter((k) => !faitsDeja.has(k));
  let faits = 0;
  for (const k of manquants.slice(0, n)) { if (await carre(env, k, true)) faits++; else break; }
  return { charges: faitsDeja.size + faits, total: liste.length, faits, erreurs: DERNIERE.splice(0) };
}

// ---------- Étape 2 : lire les sites, un petit lot à la fois ----------
export async function avancer(env, id, lot = 6) {
  const q = await env.BASE.prepare("SELECT * FROM enquetes WHERE id=?").bind(id).first();
  if (!q) return { ok: false, message: "Enquête introuvable." };
  const cands = JSON.parse(q.candidats);
  const index = JSON.parse(q.index_zone || "{}");
  const part = cands.slice(q.pos, q.pos + lot);
  const journal = [], nouveaux = [];
  await Promise.all(part.map(async (c) => {
    const r = await enqueter(c, index);
    if (r && r.etab) { const e = r.etab; Object.assign(c, { siret: e[0], nom: e[1], ens: e[2] || c.lieu, naf: e[3], cp: e[4], adr: e[5], t: e[6], commune: e[7] }); }
    journal.push({ lieu: c.lieu || c.ens || c.nom, h: hote(c.site), ok: !!r, pourquoi: r ? r.preuve : c._raison || "aucune preuve suffisante", ...(DIAG && c._diag ? { diag: c._diag } : {}) });
    if (r && c.siret && !nouveaux.includes(c.siret) && !exclu({ ...c, email: r.email })) {
      await env.BASE.prepare(`INSERT INTO contacts (siret, siren, nom, enseigne, naf, cp, commune, adresse, tranche, email, site, preuve, page_preuve, cree, maj)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(siret) DO UPDATE SET email=excluded.email, site=excluded.site, preuve=excluded.preuve, page_preuve=excluded.page_preuve, maj=excluded.maj`)
        .bind(c.siret, c.siret.slice(0, 9), c.nom, c.ens || c.lieu, c.naf, c.cp, c.commune, c.adr, c.t || 0, r.email, c.site, r.preuve, r.page, new Date().toISOString(), new Date().toISOString()).run();
      nouveaux.push(c.siret);
    }
  }));
  const pos = q.pos + part.length;
  const fini = pos >= cands.length;
  const liste = [...JSON.parse(q.trouves_liste || "[]"), ...nouveaux];
  await env.BASE.prepare("UPDATE enquetes SET pos=?, trouves=?, trouves_liste=? WHERE id=?").bind(pos, liste.length, JSON.stringify(liste), id).run();
  const trouves = nouveaux.length ? await contactsDe(env, nouveaux) : [];
  return { ok: true, pos, total: cands.length, fini, journal, trouves: trouves.map(public_) };
}

async function contactsDe(env, sirets) {
  if (!sirets.length) return [];
  return (await env.BASE.prepare(`SELECT * FROM contacts WHERE siret IN (${sirets.map(() => "?").join(",")})`).bind(...sirets).all()).results;
}
// Ce qu'on montre avant achat : l'entreprise et la ville, l'adresse e-mail masquée.
function public_(r) {
  const [u, d] = String(r.email).split("@");
  return { nom: r.enseigne || r.nom, cp: r.cp, email: u.slice(0, 1) + "•••••@" + d, preuve: r.preuve };
}

// ---------- Lecture d'un site ----------
const RE_MAIL = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,10}/gi;
function decodeCf(h) { let o = "", k = parseInt(h.slice(0, 2), 16); for (let i = 2; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16) ^ k); return o; }
function extraire(html) {
  let t = html.replace(/data-cfemail="([0-9a-f]+)"/gi, (_, h) => " " + decodeCf(h) + " ");
  t = t.replace(/&#64;|&#x40;|\s?\[at\]\s?|\s?\(at\)\s?|\s?\[arobase\]\s?|\s+arobase\s+/gi, "@").replace(/&#46;|\s?\[dot\]\s?|\s?\(point\)\s?/gi, ".");
  const visible = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ");
  const emails = new Set([...t.matchAll(RE_MAIL)].map((m) => m[0].toLowerCase().replace(/^mailto:/, "")).filter((e) => !/\.(png|jpe?g|gif|webp|svg|css|js)$/.test(e) && !/(example|exemple|domaine|votre|sentry|wixpress|u003e)/.test(e)));
  const chiffres = visible.replace(/(\d)[\s. ]+(?=\d)/g, "$1");
  return { emails, chiffres, visible: norm(visible) };
}
function liens(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const lab = norm(m[1] + " " + m[2].replace(/<[^>]+>/g, " "));
    if (!/mention|legal|contact|cgv|conditions generales|qui sommes|a propos|impressum/.test(lab)) continue;
    try { const u = new URL(m[1], base); if (hote(u.href) === hote(base)) out.push(u.href); } catch {}
  }
  return [...new Set(out)];
}
async function robotsOk(site) {
  try {
    const r = await timed(new URL("/robots.txt", site).href, {}, 4000);
    if (!r.ok) return true;
    const t = (await r.text()).slice(0, 20000);
    let tous = false;
    for (const l of t.split(/\r?\n/)) {
      const [k, ...v] = l.split(":"); const val = v.join(":").trim();
      if (/^user-agent$/i.test(k.trim())) tous = val === "*" || /acquisitor/i.test(val);
      else if (tous && /^disallow$/i.test(k.trim()) && val === "/") return false;
    }
    return true;
  } catch { return true; }
}
async function peutRecevoir(domaine) {
  if (LIBRES.test(domaine)) return true;
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domaine)}&type=MX`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    return (j.Answer || []).some((a) => a.type === 15 && !/\s\.$/.test(a.data));
  } catch { return false; }
}

export async function enqueter(c, index) {
  if (!(await robotsOk(c.site))) { c._raison = "le site refuse les robots"; return null; }
  const accueil = await texte(c.site);
  if (!accueil) { c._raison = "site injoignable"; return null; }
  const h = hote(accueil.url);
  const pages = [accueil];
  const autres = liens(accueil.html, accueil.url).slice(0, 2);
  if (!autres.length) autres.push(new URL("/mentions-legales", accueil.url).href);
  pages.push(...(await Promise.all(autres.map((u) => texte(u)))).filter(Boolean));

  const siren = c.siret ? c.siret.slice(0, 9) : "";
  let preuve = null, page = null, etab = null;
  const emails = new Map();
  const nomMots = mots(c.ens || c.lieu || c.nom);
  for (const p of pages) {
    const x = extraire(p.html);
    for (const e of x.emails) if (!emails.has(e)) emails.set(e, p.url);
    if (!preuve && siren && x.chiffres.includes(siren)) { preuve = "SIREN affiché sur le site"; page = p.url; }
    if (!preuve) for (const k in index) if (x.chiffres.includes(k)) {
      // Un établissement ciblé de la zone : si l'entreprise en a plusieurs, on prend celui du bon code postal affiché
      const l = index[k]; etab = l.find((e) => x.visible.includes(e[4])) || (l.length === 1 ? l[0] : null);
      if (etab) { preuve = "SIREN affiché sur le site"; page = p.url; break; }
    }
  }
  if (!preuve && siren) {
    for (const p of pages) {
      const x = extraire(p.html);
      const okNom = [mots(c.ens), mots(c.lieu)].some((m) => m.length && m.every((w) => x.visible.includes(w)));
      if (c.cp && x.visible.includes(c.cp) && okNom) { preuve = "nom et code postal affichés sur le site"; page = p.url; break; }
    }
  }
  if (!preuve) {
    c._raison = "le site ne prouve pas qu'il s'agit de cet établissement";
    if (DIAG) { const x = pages.map((p) => extraire(p.html)); c._diag = { pages: pages.map((p) => p.url), emails: [...emails.keys()].slice(0, 5), neuf: [...new Set(x.flatMap((y) => y.chiffres.match(/(?<!\d)\d{9}(?!\d)|(?<!\d)\d{14}(?!\d)/g) || []))].slice(0, 6), cp: c.cp, cpVu: x.some((y) => y.visible.includes(c.cp || "@@")), mots: [mots(c.ens), mots(c.lieu)], siret: c.siret, nom: c.nom }; }
    return null;
  }

  // L'adresse doit appartenir au site (ou être une messagerie classique affichée sur le site)
  const osm = String(c.email_osm || "").toLowerCase().split(/[;,\s]/)[0];
  const choix = [...emails.keys()].filter((e) => { const d = e.split("@")[1]; return d === h || d.endsWith("." + h) || LIBRES.test(d); }); // une adresse du « domaine parent » d'un sous-site (ex. x.pharminfo.fr -> @pharminfo.fr) est celle de l'hébergeur : refusée
  if (osm && /@/.test(osm) && (hote("https://" + osm.split("@")[1]) === h || LIBRES.test(osm.split("@")[1])) && !choix.includes(osm)) choix.push(osm);
  choix.sort((a, b) => (b.split("@")[1] === h) - (a.split("@")[1] === h) || /^(contact|info|accueil|bonjour|hello)@/.test(b) - /^(contact|info|accueil|bonjour|hello)@/.test(a));
  for (const e of choix) {
    if (/^(no-?reply|ne-pas-repondre|webmaster|postmaster|admin|abuse|rgpd|dpo|privacy)@/.test(e)) continue;
    if (await peutRecevoir(e.split("@")[1])) return { email: e, preuve, page, etab };
  }
  c._raison = emails.size ? "adresse e-mail non vérifiable" : "aucune adresse e-mail sur le site";
  return null;
}

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS contacts (siret TEXT PRIMARY KEY, siren TEXT, nom TEXT, enseigne TEXT, naf TEXT, cp TEXT, commune TEXT, adresse TEXT, tranche INTEGER, email TEXT, site TEXT, preuve TEXT, page_preuve TEXT, cree TEXT, maj TEXT)`,
  `CREATE INDEX IF NOT EXISTS contacts_commune ON contacts (commune, naf)`,
  `CREATE TABLE IF NOT EXISTS carte (cle TEXT, part INTEGER, n INTEGER, maj TEXT, data TEXT, PRIMARY KEY (cle, part))`,
  `CREATE TABLE IF NOT EXISTS enquetes (id TEXT PRIMARY KEY, criteres TEXT, cree TEXT, candidats TEXT, pos INTEGER, total_zone INTEGER, deja TEXT, trouves INTEGER DEFAULT 0, index_zone TEXT, trouves_liste TEXT)`,
];

// Export CSV d'une enquête (réservé, clé secrète ADMIN_CLE)
export async function exporter(env, id) {
  const q = await env.BASE.prepare("SELECT * FROM enquetes WHERE id=?").bind(id).first();
  if (!q) return null;
  const sirets = [...JSON.parse(q.deja || "[]"), ...JSON.parse(q.trouves_liste || "[]")];
  const rows = [];
  for (let i = 0; i < sirets.length; i += 90) rows.push(...(await contactsDe(env, sirets.slice(i, i + 90))));
  const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const head = ["entreprise", "enseigne", "siret", "activite", "adresse", "code_postal", "email", "site", "preuve", "page_preuve", "date"];
  const lines = rows.filter((r) => !exclu({ siret: r.siret, nom: r.nom, ens: r.enseigne, cp: r.cp, email: r.email, site: r.site, commune: r.commune }))
    .map((r) => [r.nom, r.enseigne, r.siret, r.naf, r.adresse, r.cp, r.email, r.site, r.preuve, r.page_preuve, r.maj].map(esc).join(";"));
  return "﻿" + head.join(";") + "\n" + lines.join("\n");
}
