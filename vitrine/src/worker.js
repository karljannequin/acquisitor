// Vitrine ACQUISITOR (acquisitor.fr)
// - "/", "/mentions-legales", "/confidentialite" : les pages
// - "/api/metiers"   : le catalogue des métiers pour la recherche guidée
// - "/api/lieux"     : villes, départements et régions proposés pendant la saisie
// - "/api/compter"   : nombre exact d'entreprises (copie de la base officielle, stockage DONNEES)
// - "/api/comprendre": transforme une phrase en recherche guidée
// - "/api/liste"     : inscription à la liste d'attente (stockage LISTE)
// - "/api/enquete/*" : le détective (agent.js) cherche les contacts sûrs, base D1 BASE
import PAGE from "./index.html";
import MENTIONS from "./mentions-legales.html";
import CONFIDENTIALITE from "./confidentialite.html";
import { CATALOGUE, METIERS } from "./catalogue.js";
import { demarrer, avancer, exporter, SCHEMA, diag, remplirCarte } from "./agent.js";

const JSON_H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: JSON_H });
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'\-]/g, " ").replace(/\s+/g, " ").trim();

// Paris, Lyon et Marseille sont découpés en arrondissements dans la base.
const PLM = { "75056": Array.from({ length: 20 }, (_, i) => String(75101 + i)), "69123": Array.from({ length: 9 }, (_, i) => String(69381 + i)), "13055": Array.from({ length: 16 }, (_, i) => String(13201 + i)) };
// Effectif minimum -> première tranche comptée : [inconnu, 1-2, 3-5, 6-9, 10-19, 20-49, 50+]
const TAILLES = { toutes: null, "1+": 1, "3+": 2, "6+": 3, "10+": 4, "20+": 5, "50+": 6 };

// Données gardées en mémoire tant que le serveur reste chaud.
const MEM = new Map();
let SCHEMA_OK = false;
async function kv(env, key) {
  if (MEM.has(key)) return MEM.get(key);
  const v = await env.DONNEES.get(key, "json");
  MEM.set(key, v);
  return v;
}

function dist(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const d = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(d));
}

// Communes couvertes par la zone choisie (null = toute la France)
function zoneCommunes(geo, lieu, rayon) {
  if (!lieu || lieu.type === "fr") return null;
  const set = new Set();
  if (lieu.type === "dep") { for (const c in geo) if (geo[c][2] === lieu.code) set.add(c); return set; }
  if (lieu.type === "reg") { for (const c in geo) if (geo[c][3] === lieu.code) set.add(c); return set; }
  const centre = geo[lieu.code];
  if (!centre) return set;
  set.add(lieu.code);
  for (const a of PLM[lieu.code] || []) set.add(a);
  if (rayon > 0) for (const c in geo) if (dist(centre, geo[c]) <= rayon) set.add(c);
  return set;
}

function somme(data, communes, g) {
  if (!data) return 0;
  let n = 0;
  const add = (a) => { if (!a) return; for (let i = g == null ? 0 : g; i < a.length; i++) n += a[i]; };
  if (communes) for (const c of communes) add(data[c]);
  else for (const c in data) add(data[c]);
  return n;
}

async function compter(env, sel) {
  const acts = (sel.acts || []).filter((id) => METIERS[id]).slice(0, 20);
  if (!acts.length) return { ok: false, message: "Choisissez au moins un métier." };
  const geo = await kv(env, "geo");
  if (!geo) return { ok: false, message: "Le comptage est en cours de mise à jour. Réessayez dans un instant." };
  const lieu = sel.lieu && ["com", "dep", "reg", "fr"].includes(sel.lieu.type) ? sel.lieu : { type: "fr" };
  const rayon = Math.max(0, Math.min(200, +sel.km || 0));
  const g = TAILLES[sel.taille] ?? null;
  const communes = zoneCommunes(geo, lieu, lieu.type === "com" ? rayon : 0);

  const nafSet = new Set(acts.filter((id) => !METIERS[id].re).flatMap((id) => METIERS[id].naf.split(",")));
  const parts = [];
  let total = 0;
  for (const code of nafSet) total += somme(await kv(env, "c:" + code), communes, g);
  for (const id of acts) {
    const m = METIERS[id];
    if (!m.re) { let n = 0; for (const code of m.naf.split(",")) n += somme(await kv(env, "c:" + code), communes, g); parts.push({ l: m.l, n }); continue; }
    // Repérées par leur nom, catégorie par catégorie : on n'ajoute que celles qui ne sont pas déjà comptées.
    let n = 0, ajout = 0;
    for (const code of m.naf.split(",")) { const x = somme(await kv(env, "r:" + id + ":" + code), communes, g); n += x; if (!nafSet.has(code)) ajout += x; }
    total += ajout; parts.push({ l: m.l, n, inclus: ajout === 0 && n > 0 });
  }
  if (!MEM.has("maj")) MEM.set("maj", (await env.DONNEES.get("maj")) || "");
  return { ok: true, total, parts, maj: MEM.get("maj") };
}

async function lieux(env, q, max = 8) {
  const L = await kv(env, "lieux");
  const t = norm(q);
  if (!L || t.length < 2) return [];
  const res = [];
  for (const x of L) {
    const n = norm(x[2]);
    const i = n.indexOf(t);
    if (i === -1 && !(x[0] === "dep" && x[1].toLowerCase() === t)) continue;
    res.push([i === 0 || n === t ? 0 : 1, -x[4], x]);
  }
  res.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return res.slice(0, max).map(([, , x]) => ({ type: x[0], code: x[1], label: x[2], sub: x[3] }));
}

// Une phrase -> une recherche guidée
async function comprendre(env, text) {
  const t = " " + norm(text) + " ";
  const acts = [];
  for (const f of CATALOGUE) for (const m of f.items) if (m.k.some((k) => { const n = norm(k); return n.length > 3 ? t.includes(n) : t.includes(" " + n + " "); })) acts.push(m.id);
  const kmM = t.match(/(\d+)\s*km/) || t.match(/\+\s*(\d+)/);
  const sal = +((t.match(/(\d+)\s*salari/) || [])[1] || 0);
  const taille = sal >= 50 ? "50+" : sal >= 20 ? "20+" : sal >= 10 ? "10+" : sal >= 6 ? "6+" : sal >= 3 ? "3+" : sal >= 1 ? "1+" : "toutes";
  const L = (await kv(env, "lieux")) || [];
  let best = null;
  for (const x of L) {
    const n = norm(x[2]);
    if (n.length < 3 || !t.includes(" " + n + " ")) continue;
    const score = (x[0] === "com" ? 0 : 1) * 1e12 + n.length * 1e9 + x[4];
    if (!best || score > best[0]) best = [score, x];
  }
  let lieu = null;
  if (/toute la france|en france|partout/.test(t)) lieu = { type: "fr", label: "Toute la France" };
  else if (best) lieu = { type: best[1][0], code: best[1][1], label: best[1][2], sub: best[1][3] };
  return { ok: true, acts: [...new Set(acts)], lieu, km: kmM ? +kmM[1] : (lieu && lieu.type === "com" ? 10 : 0), taille };
}

export default {
  // Tâche de fond (adresse de test seulement pour l'instant) : charge la carte de France petit à petit
  async scheduled(event, env, ctx) {
    if (env.REMPLIR_CARTE) ctx.waitUntil(remplirCarte(env, (k) => kv(env, k)).then((r) => console.log("carte", JSON.stringify(r))));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.acquisitor.fr") { url.hostname = "acquisitor.fr"; return Response.redirect(url.toString(), 301); }
    try {
      if (url.pathname === "/api/metiers") return new Response(JSON.stringify(CATALOGUE.map((f) => ({ f: f.f, items: f.items.map((i) => ({ id: i.id, l: i.l, k: i.k })) }))), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
      if (url.pathname === "/api/lieux") return json({ ok: true, lieux: await lieux(env, (url.searchParams.get("q") || "").slice(0, 60)) });
      if (url.pathname === "/api/compter" && request.method === "POST") { let b = {}; try { b = await request.json(); } catch {} return json(await compter(env, b)); }
      if (url.pathname.startsWith("/api/enquete/")) {
        if (!SCHEMA_OK) { for (const q of SCHEMA) await env.BASE.prepare(q).run(); SCHEMA_OK = true; }
        if (url.pathname === "/api/enquete/start" && request.method === "POST") { let b = {}; try { b = await request.json(); } catch {} return json(await demarrer(env, (k) => kv(env, k), b)); }
        if (url.pathname === "/api/enquete/step" && request.method === "POST") { let b = {}; try { b = await request.json(); } catch {} diag(b.diag && env.ADMIN_CLE && b.cle === env.ADMIN_CLE); return json(await avancer(env, String(b.id || ""))); }
        if (url.pathname === "/api/enquete/carte") {
          if (!env.ADMIN_CLE || url.searchParams.get("cle") !== env.ADMIN_CLE) return json({ ok: false, message: "Accès réservé." }, 403);
          return json(await remplirCarte(env, (k) => kv(env, k), +url.searchParams.get("n") || 3));
        }
        if (url.pathname === "/api/enquete/export") {
          if (!env.ADMIN_CLE || url.searchParams.get("cle") !== env.ADMIN_CLE) return json({ ok: false, message: "Accès réservé." }, 403);
          const csv = await exporter(env, url.searchParams.get("id") || "");
          if (!csv) return json({ ok: false, message: "Enquête introuvable." }, 404);
          return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="acquisitor-contacts.csv"', "cache-control": "no-store" } });
        }
      }
      if (url.pathname === "/api/comprendre") return json(await comprendre(env, (url.searchParams.get("q") || "").slice(0, 200)));
    } catch (e) {
      console.log("api", e && e.stack || e);
      return json({ ok: false, message: "Un souci technique est survenu. Réessayez dans un instant.", ...(env.ADMIN_CLE && url.searchParams.get("cle") === env.ADMIN_CLE ? { detail: String(e && e.stack || e) } : {}) }, 500);
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

    const pages = { "/": PAGE, "/mentions-legales": MENTIONS, "/confidentialite": CONFIDENTIALITE };
    const html = pages[url.pathname.replace(/\/+$/, "") || "/"];
    if (!html) return Response.redirect(url.origin + "/", 302);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  },
};
