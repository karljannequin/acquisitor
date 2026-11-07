# ACQUISITOR

Aucun contact ne lui échappe. Outil de prospection multi-marques : il trouve les bons clients, leur écrit au bon moment et suit chaque réponse. Une base de contacts unique qui grandit chaque nuit.

| Dossier | Contenu |
|---|---|
| `vitrine/` | Le site public : https://acquisitor.fr (Worker `acquisitor-vitrine`) |
| `maquettes/outil.html` | Maquette cliquable de l'outil (données fictives) |
| `maquettes/accueil.html` | Maquette de la page d'accueil |
| `documents/cahier-des-charges.md` | Toutes les décisions prises pour construire l'outil |

Mise en ligne : `cd vitrine && npx wrangler deploy`, toujours après accord.

Données (contacts, campagnes, envois) : base D1 et fichiers R2 Cloudflare, jamais dans ce dépôt.
