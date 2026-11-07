# Règles communes à tous nos projets

- Chaque projet sert deux usages : il est **vendu** à des clients et **utilisé en interne** (Meddley, SCI, Speedy Pizz...). Le code doit gérer plusieurs clients (multi-comptes), pas un seul.
- Stack standard, la même partout :
  - **GitHub** : un dépôt privé par projet. C'est la source du code et son historique.
  - **Cloudflare** : hébergement (Workers), base de données (D1), fichiers (R2).
  - **Brevo** : e-mails (transactionnels et campagnes).
  - **Stripe** : abonnements et paiements.
- Les clés secrètes (Stripe, Brevo, etc.) ne vont **jamais** dans le code ni dans GitHub. Elles vont dans les secrets Cloudflare (`wrangler secret put`).
- Le code en production est celui déployé sur Cloudflare ; après chaque déploiement, il doit aussi être commité sur GitHub.
- Langue de l'interface et des échanges : français.

## Façon de travailler avec Karl

- Karl donne des demandes simples (« modifie ça », « crée un nouveau client ») : Claude trouve tout seul la bonne partie du code et fait le nécessaire, sans lui demander de détails techniques.
- **Sauvegarde automatique** : après chaque modification qui fonctionne, Claude commite et pousse sur GitHub sans attendre qu'on le lui demande.
- **Mise en ligne** : Claude vérifie la modification, la montre à Karl, et déploie sur Cloudflare dès qu'il dit « ok, en ligne ». Puis il recommite la version déployée.
- Les données (contacts, entreprises, campagnes envoyées) se créent dans l'outil ou dans le stockage Cloudflare, jamais dans le code.
- Toujours expliquer en français simple, sans jargon.

## RÈGLE ABSOLUE : exclusions permanentes

- Sont exclus de tout Acquisitor, sans aucune exception : **Domino's Pizza Vendôme** (le restaurant de Vendôme uniquement, les autres Domino's ne sont pas concernés), **la société RYD** (et tous ses établissements), **Malek Hassani** (ou Hassanni, toutes orthographes) **et toutes les sociétés qu'il dirige ou possède**, dont son groupe d'entreprises à Blois.
- Jamais collectés, jamais gardés dans la base, jamais contactés, jamais fournis à un client, pour aucune marque. Reconnaissance par numéro d'entreprise (SIREN), nom, adresse et nom des dirigeants au registre officiel.
- Vérification à l'entrée de la base (collecte, import), avant chaque envoi et avant chaque fourniture de contacts. Impossible à désactiver dans l'interface.

## ACQUISITOR : ce que c'est

- Outil de prospection **multi-marques** de Karl : il collecte des contacts d'entreprises (base unique qui grandit et n'est jamais effacée), puis envoie des campagnes pour chaque marque (ZeBooster, Speedy Pizz, Yellow Immo, Hébergements Insolites Vendôme, futures licences…). Baseline : « Aucun contact ne lui échappe ».
- Usage interne d'abord. Vente ensuite : Karl est d'accord pour fournir des contacts d'entreprises et des campagnes à des clients (voir § 11 du cahier des charges : pas de revente d'e-mails nominatifs ni de données Google Maps).
- Toutes les décisions prises avec Karl sont dans `documents/cahier-des-charges.md` : le lire avant de construire une partie.
- Charte de l'outil : blanc et bleu `#1E5EFF`, texte `#0E1A33`, police Geist (titres et texte, choisie pour son côté strict et professionnel). Logo : loupe blanche dans un carré bleu. Rien de ZeBooster dans l'interface.
- Charte des e-mails : celle de chaque marque, reprise de son site (voir le cahier des charges).

## ACQUISITOR : organisation du code

- `vitrine/` : le site public (Worker `acquisitor-vitrine`, https://acquisitor.fr et www). Page `src/index.html`, servie par `src/worker.js`, avec `/mentions-legales` et `/confidentialite` (éditeur : MEDDLEY, comme ZeBooster), `/api/estimation` (comptage dans le registre officiel) et `/api/liste` (liste d'attente, KV `acquisitor-vitrine`, binding `LISTE`). En ligne depuis le 07/11/2026 (version actuelle `761d9554`).
- `maquettes/` : `outil.html` (maquette cliquable complète de l'outil, données fictives) et `accueil.html` (page d'accueil). Elles servent de référence pour construire l'application.
- `app/` (à venir) : l'application (Worker, base D1, fichiers R2).
- Domaine `acquisitor.fr` : acheté chez IONOS, serveurs de noms Cloudflare (`greg` / `martha`), zone Cloudflare `9053f85f129a5daf94a4700e2222b9ad`.
- Mise en ligne (toujours après accord de Karl), depuis `vitrine/` (ou `app/`) :
  `CLOUDFLARE_API_TOKEN=proxy-injected CLOUDFLARE_ACCOUNT_ID=336c3c58734531af20625440551a17b6 npx wrangler@4 deploy --message "…"`
- Le réseau de la session ne peut pas ouvrir les sites : vérifier une mise en ligne via l'API Cloudflare.
- Le jeton Cloudflare de la session ne peut ni créer de zone ni lire les bases D1 des autres projets : demander à Karl de le faire dans le tableau de bord si besoin.
- En cas de problème : `npx wrangler@4 rollback <id de version>` (liste : `npx wrangler@4 deployments list`).
