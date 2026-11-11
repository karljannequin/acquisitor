// Le détective en continu : il lit, secteur par secteur, tous les sites relevés sur la carte
// et range dans la base les contacts prouvés (même règles que l'enquête, voir agent.js).
// Il ne contacte personne : il lit des pages publiques, lentement, en respectant les sites qui refusent les robots.

import { enqueter, exclu, norm, lireCarre, CLES } from "./agent.js";

const MOTS_VIDES = new Set("sarl sas sasu eurl sa snc sci ets etablissements societe ste le la les l de du des d et a au aux en chez".split(" "));
const mots = (t) => norm(t).split(" ").filter((w) => w.length >= 3 && !MOTS_VIDES.has(w));
const CHAINES_SITES = /facebook|instagram|google|pagesjaunes|tripadvisor|linktr|business\.site|ubereats|deliveroo|justeat|planity|doctolib|wix\.com$/;
const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
function dist(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const d = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(d));
}
const PAS = 0.25;
const MEM = new Map();

async function etat(env) {
  const r = await env.BASE.prepare("SELECT valeur FROM etat WHERE cle='curseur'").first();
  return r ? JSON.parse(r.valeur) : { k: 0, i: 0 };
}

// Prépare un secteur : ses lieux avec site, et les établissements du registre des communes du secteur
async function secteur(env, kv, cle) {
  if (MEM.has("s:" + cle)) return MEM.get("s:" + cle);
  const data = (await lireCarre(env, cle)) || [];
  const parSite = {};
  const lieux = [];
  for (const x of data) {
    const t = Object.fromEntries(CLES.map((k, i) => [k, x[i + 2]]));
    let site = t.website || t["contact:website"] || t.url || "";
    if (!site) continue;
    if (!/^https?:\/\//i.test(site)) site = "https://" + site.replace(/^\/+/, "");
    const h = hote(site);
    if (!h || CHAINES_SITES.test(h)) continue;
    parSite[h] = (parSite[h] || 0) + 1;
    lieux.push({ nom: t.name, site, h, p: [x[0], x[1]], email: t.email || t["contact:email"] || "", cp: t["addr:postcode"] });
  }
  const garde = lieux.filter((l) => parSite[l.h] <= 2 && !exclu({ nom: l.nom, site: l.site, cp: l.cp }));
  const [i, j] = cle.split(":").map(Number);
  const geo = await kv("geo");
  const communes = [];
  for (const c in geo) { const g = geo[c]; if (g[0] >= i * PAS - 0.05 && g[0] < (i + 1) * PAS + 0.05 && g[1] >= j * PAS - 0.07 && g[1] < (j + 1) * PAS + 0.07) communes.push([c, g]); }
  const etabs = [];
  await Promise.all(communes.map(async ([c, g]) => { const l = await kv("e:" + c); if (l) for (const e of l) if (!exclu({ siret: e[0], nom: e[1], ens: e[2], cp: e[4], commune: c })) etabs.push({ e, c, p: g }); }));
  const index = {};
  for (const x of etabs) (index[x.e[0].slice(0, 9)] ||= []).push([...x.e, x.c]);
  const s = { lieux: garde, etabs, index };
  MEM.clear(); MEM.set("s:" + cle, s);
  return s;
}

export async function nuit(env, kv, n = 4) {
  const cles = (await env.BASE.prepare("SELECT DISTINCT cle FROM carte ORDER BY cle").all()).results.map((r) => r.cle);
  if (!cles.length) return { fait: 0 };
  let cur = await etat(env);
  if (cur.k >= cles.length) cur = { k: 0, i: 0 };
  let s = await secteur(env, kv, cles[cur.k]);
  for (let saut = 0; cur.i >= s.lieux.length && saut < 8; saut++) {
    cur = { k: (cur.k + 1) % cles.length, i: 0 };
    s = await secteur(env, kv, cles[cur.k]);
  }
  const part = s.lieux.slice(cur.i, cur.i + n);
  let trouves = 0;
  await Promise.all(part.map(async (l) => {
    const deja = await env.BASE.prepare("SELECT 1 FROM lus WHERE site=?").bind(l.h).first();
    if (deja) return;
    // Établissement du registre au même nom, à moins de 4 km
    const m = mots(l.nom);
    let best = null;
    if (m.length) for (const x of s.etabs) {
      const d = dist(l.p, x.p); if (d > 4) continue;
      const nm = new Set(mots((x.e[2] || "") + " " + (x.e[1] || "")));
      if (m.every((w) => nm.has(w)) && (!best || d < best.d)) best = { x, d };
    }
    const c = best ? { siret: best.x.e[0], nom: best.x.e[1], ens: best.x.e[2], naf: best.x.e[3], cp: best.x.e[4], adr: best.x.e[5], t: best.x.e[6], commune: best.x.c, lieu: l.nom, site: l.site, email_osm: l.email }
      : { siret: null, lieu: l.nom, site: l.site, email_osm: l.email };
    let r = null;
    try { r = await enqueter(c, s.index); } catch {}
    if (r && r.etab) { const e = r.etab; Object.assign(c, { siret: e[0], nom: e[1], ens: e[2] || l.nom, naf: e[3], cp: e[4], adr: e[5], t: e[6], commune: e[7] }); }
    const now = new Date().toISOString();
    if (r && c.siret && !exclu({ ...c, email: r.email })) {
      await env.BASE.prepare(`INSERT INTO contacts (siret, siren, nom, enseigne, naf, cp, commune, adresse, tranche, email, site, preuve, page_preuve, cree, maj)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(siret) DO UPDATE SET email=excluded.email, site=excluded.site, preuve=excluded.preuve, page_preuve=excluded.page_preuve, maj=excluded.maj`)
        .bind(c.siret, c.siret.slice(0, 9), c.nom, c.ens || l.nom, c.naf, c.cp, c.commune, c.adr, c.t || 0, r.email, l.site, r.preuve, r.page, now, now).run();
      trouves++;
    }
    await env.BASE.prepare("INSERT OR REPLACE INTO lus (site, nom, statut, date) VALUES (?,?,?,?)").bind(l.h, l.nom, r && c.siret ? "trouvé" : (c._raison || "sans preuve"), now).run();
  }));
  cur.i += part.length;
  if (cur.i >= s.lieux.length) cur = { k: cur.k + 1, i: 0 };
  await env.BASE.prepare("INSERT OR REPLACE INTO etat (cle, valeur) VALUES ('curseur', ?)").bind(JSON.stringify(cur)).run();
  return { secteur: cur.k, total_secteurs: cles.length, lus: part.length, trouves };
}

export const SCHEMA_NUIT = [
  `CREATE TABLE IF NOT EXISTS etat (cle TEXT PRIMARY KEY, valeur TEXT)`,
  `CREATE TABLE IF NOT EXISTS lus (site TEXT PRIMARY KEY, nom TEXT, statut TEXT, date TEXT)`,
];

// Page privée « Le stock » : ce qui a été collecté, au fur et à mesure
export async function pageStock(env) {
  const q = async (sql) => (await env.BASE.prepare(sql).first()) || {};
  const carte = await q("SELECT count(DISTINCT cle) carres, coalesce(sum(n),0) lieux FROM carte");
  const lus = await q("SELECT count(*) n, sum(statut='trouvé') ok FROM lus");
  const nb = await q("SELECT count(*) n FROM contacts");
  const raisons = (await env.BASE.prepare("SELECT statut, count(*) n FROM lus GROUP BY statut ORDER BY n DESC").all()).results;
  const derniers = (await env.BASE.prepare("SELECT enseigne, nom, cp, email, site, preuve, maj FROM contacts ORDER BY maj DESC LIMIT 200").all()).results;
  const f = (n) => Number(n || 0).toLocaleString("fr-FR");
  const e = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="60">
<title>ACQUISITOR · Le stock</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;800&display=swap">
<style>:root{--b:#1E5EFF;--i:#0E1A33;--m:#5E6A85;--l:#E3E9F5}body{margin:0;font-family:Geist,system-ui,sans-serif;color:var(--i);background:#F6F8FD}
.w{max-width:1100px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px;font-size:28px;letter-spacing:-.02em}p.s{color:var(--m);margin:0 0 20px}
.k{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:20px}.k div{background:#fff;border:1px solid var(--l);border-radius:14px;padding:14px}
.k b{display:block;font-size:28px;color:var(--b)}.k small{color:var(--m)}.k .ok{background:var(--b);color:#fff}.k .ok b{color:#fff}.k .ok small{color:#DCE6FF}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--l);border-radius:14px;overflow:hidden;font-size:14px}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--l)}th{background:#F0F4FD;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--m)}
td.e{font-weight:600;color:var(--b)}.r{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 20px}.r span{background:#fff;border:1px solid var(--l);border-radius:999px;padding:5px 10px;font-size:13px}
@media(max-width:700px){.k{grid-template-columns:repeat(2,minmax(0,1fr))}td:nth-child(5),th:nth-child(5),td:nth-child(6),th:nth-child(6){display:none}}</style></head><body><div class="w">
<h1>Le stock</h1><p class="s">Contacts prouvés collectés par le détective. La page se met à jour toute seule chaque minute.</p>
<div class="k"><div><b>${f(carte.lieux)}</b><small>commerces avec site relevés (${f(carte.carres)} secteurs sur 1 257)</small></div>
<div><b>${f(lus.n)}</b><small>sites lus</small></div><div class="ok"><b>${f(nb.n)}</b><small>e-mails prouvés en stock</small></div>
<div><b>${lus.n ? Math.round((100 * (lus.ok || 0)) / lus.n) : 0} %</b><small>des sites lus donnent un e-mail prouvé</small></div></div>
<div class="r">${raisons.map((x) => `<span>${e(x.statut)} : ${f(x.n)}</span>`).join("")}</div>
<table><thead><tr><th>Entreprise</th><th>Code postal</th><th>E-mail</th><th>Preuve</th><th>Site</th><th>Date</th></tr></thead><tbody>
${derniers.map((r) => `<tr><td>${e(r.enseigne || r.nom)}</td><td>${e(r.cp)}</td><td class="e">${e(r.email)}</td><td>${e(r.preuve)}</td><td>${e(r.site)}</td><td>${e(String(r.maj).slice(0, 16).replace("T", " "))}</td></tr>`).join("")}
</tbody></table></div></body></html>`;
}
