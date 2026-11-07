# ACQUISITOR · Cahier des charges

Décisions prises avec Karl le 07/11/2026. La maquette `maquettes/outil.html` montre chaque écran.

## 1. Le principe

- Une **base de contacts unique** pour toutes les marques. Tout ce qui est collecté est gardé **pour toujours** (choix de Karl), mis à jour à chaque nouvelle collecte, sans doublon.
- Chaque contact garde : date d'entrée, source, et **l'historique de démarchage par marque**.
- Marques au départ : ZeBooster, Speedy Pizz, Yellow Immo, Hébergements Insolites Vendôme. On peut en ajouter (licences, services à la personne…).
- **Parcours en 3 étapes** :
  1. **Campagnes** : l'atelier. On crée et on range les e-mails de chaque marque. On n'y envoie rien (sauf un test).
  2. **Agent recherche** : remplit la base, seul, selon des missions.
  3. **Agent envoi** : le seul endroit d'où partent les e-mails.

## 2. Écrans (menu à gauche)

Tableau de bord · Rechercher · Ma base · Campagnes · Agent recherche · Agent envoi · Réponses · Suivi · Budget & sécurité · Marques & réglages.

- **Tableau de bord** : rapport du matin (contacts ajoutés cette nuit, dépense, réponses, envois à valider), chiffres clés, chiffres par marque, recherches récentes, à faire aujourd'hui.
- **Rechercher** : une phrase (« pizzerias à 30 km de Vendôme plus de 5 salariés ») ou des filtres : activité, salariés minimum, « pas démarché par telle marque depuis… », zone **autour d'une ville + rayon / dans une ville / département / région**, contacts avec e-mail seulement. Deux modes : **dans ma base** (gratuit, instantané) ou **ma base + collecter** (sources gratuites, ou payantes avec budget maximum). Résultats : une colonne par marque avec la date du dernier démarchage (vert jamais, rouge moins de 3 mois, gris relançable), étiquette « En base » / « Nouveau ». Enregistrer une recherche.
- **Ma base** : chiffres (total, ajoutés ce mois, mis à jour), croissance, recherches enregistrées (relancer), filtres et « Envoyer à ces contacts avec l'agent ».
- **Réponses** : les réponses de toutes les boîtes d'envoi, triées par l'IA (intéressé, pas intéressé, absent, ne plus écrire). Une réponse arrête les relances du contact. « Ne plus écrire » ajoute à la liste commune.
- **Suivi** : résultats par campagne, liste « ne plus contacter », santé des envois.
- **Budget & sécurité** : voir § 6.
- **Marques & réglages** : charte e-mail, boîte d'envoi, envois par jour, signature, sources de données, garde-fous.

## 3. Sources de données

- Gratuites d'abord : registre officiel des entreprises (SIRENE : activité, adresse, salariés, dirigeants), annuaire de l'Éducation nationale (écoles avec e-mail), base officielle du tourisme (DATAtourisme), répertoire des associations (RNA), OpenStreetMap, **lecture des sites web** des entreprises (e-mail, nom, téléphone).
- Payantes, seulement si autorisé et avec plafond : Google Maps (au-delà du quota gratuit), recherche d'e-mails nominatifs.
- Attention : Google Maps interdit de garder ses données pour toujours (sauf l'identifiant du lieu). La base doit reposer surtout sur le registre officiel et les sites web.

## 4. Agent recherche

- Missions écrites en une phrase, avec fréquence (chaque jour / lundi / mois / une fois), marque, budget maximum par mois.
- **Ne garde que les contacts sûrs** (e-mail vérifié, bonne zone, bonne activité). Les fiches douteuses sont écartées, jamais ajoutées.
- Historique des missions en menus déroulants : chaque passage (examinées, déjà en base, écartées, ajoutées, coût), contrôles du dernier passage (sources consultées, doublons évités, e-mails vérifiés, entreprises fermées écartées, zone et activité respectées, fiches écartées), exemples de contacts ajoutés.
- Travaille la nuit, par petits lots, reprend la nuit suivante si besoin, réessaie les sites en panne, lit les sites lentement et respecte ceux qui refusent les robots, se souvient des zones déjà fouillées.

## 5. Agent envoi

- Case à remplir : « aujourd'hui on envoie une campagne aux coiffeurs de Vendôme + 50 km ».
- Choix de la campagne parmi celles créées, relance (7 jours, 14 jours, aucune).
- Case à cocher **collecte payante si la base ne suffit pas**, avec budget maximum.
- « Préparer l'envoi » : ce que l'agent a compris, contacts déjà en base, à collecter, retirés (contactés il y a moins de 3 mois, « ne plus contacter »), total et nombre de jours. Puis « Valider et lancer l'envoi ».
- Envois préparés par l'agent à valider. Historique des envois avec, pour chaque contact : **lu (indicatif), cliqué (quel bouton), répondu**.
- Horaires : la nuit on prépare, le jour on envoie (lundi-vendredi, 9 h-17 h par défaut). Montée en douceur des boîtes neuves (10 par jour au début, puis jusqu'à 50).
- Garde-fous : accord de Karl avant chaque nouvel envoi, une seule relance automatique, une seule marque à la fois par contact pendant 3 mois, liste « ne plus contacter » commune (toujours appliquée), arrêt automatique si plus de 5 % d'adresses en erreur ou un signalement « indésirable ».
- **Envoi** : la prospection ne passe pas par le compte Brevo des marques (Brevo interdit les envois à des contacts non inscrits). Boîtes d'envoi dédiées sur des noms de domaine secondaires par marque. Brevo reste pour les clients et les inscrits, et pour les e-mails internes (rapport du matin, alertes).

## 6. Budget et sécurité

- Trois plafonds : par mois tout compris, par mission, par nuit. L'agent réserve le coût estimé avant chaque passage ; s'il ne reste pas assez, il fait la partie gratuite. Alerte à 80 %, arrêt automatique à 100 %.
- Limites de dépense posées aussi chez les fournisseurs (Google, Anthropic, outil de recherche d'e-mails).
- Bouton **« Tout arrêter »** visible partout.
- Alertes par e-mail : budget à 80 %, deux nuits de suite en erreur.
- Rapport du matin par e-mail à 7 h.
- **Sauvegarde** chaque nuit : stockage Cloudflare R2 ; plus tard, copie chiffrée dans un dépôt GitHub privé dédié `acquisitor-sauvegardes` (accord de Karl). Conservation illimitée.

## 7. Campagnes

- Arrivée sur Campagnes : les marques, chacune avec ses campagnes (Modifier, Envoyer →) et « + Nouvelle campagne ».
- **Modèle de toutes les campagnes = la campagne « Entreprises – Noël 2026 » d'Hébergements Insolites Vendôme** (`hebergements-insolites-vendome/src/40-entreprises-b2b.js`, fonction `campaignMail`, ne jamais modifier ce dépôt). Elle est reprise dans Acquisitor comme première campagne de la rubrique Hébergement Insolite. Quand Acquisitor sera prêt, Karl retirera cette partie du site Hébergement Insolite.
- Construction par blocs, dans l'ordre voulu, chaque bloc déplaçable (tout en haut, monter, descendre, dupliquer, supprimer) : Logo (petit ou grand, lien facultatif, logo animé possible), Surtitre, Titre, Filet, **Photo** (envoi d'une photo, petite ligne au-dessus, **lien facultatif**), Texte (ligne commençant par « – » = coche ✓, paragraphe commençant par 🎁 = encadré, **gras**), **Bouton** (texte, page de destination de la marque ou autre adresse, style plein / contour / souligné, position, petite phrase dessous), Offres / tarifs (cartes avec photo, nom, description, prix barré et prix), Signature, PS.
- **Chaque bouton mène forcément vers une page choisie** dans la liste des pages de la marque (ex. Hébergements Insolites → offre entreprises). Chaque clic est suivi.
- **Apparence** réglable : fond de la page, fond de l'e-mail, bordure, accent, filets, bouton, texte du bouton, titres, texte, encadrés, police des titres, pied de page. Bouton « Reprendre la charte de la marque ».
- **Version relance** : objet, titre, texte d'introduction et texte de fin remplacés ; le reste est repris ; pas de PS.
- Aperçu en direct, ordinateur / téléphone, premier envoi / relance, avec les données d'un vrai contact. Envoi d'un test.
- **Générateur IA** : suit la charte de la marque (couleurs, polices, logo, ton), s'inspire des campagnes précédentes cochées (la meilleure en clics d'office), propose des boutons d'appel à l'action propres à la marque, reliés à ses pages.
- Balises : `{{prenom}}`, `{{entreprise}}`, `{{ville}}`, `{{activite}}`, `{{signature}}`.

## 8. Chartes des marques (pour les e-mails)

Reprises des sites, pas seulement des logos. L'outil final ira lire le site de chaque marque.

| Marque | Couleurs | Polices | État |
|---|---|---|---|
| ZeBooster | jaune `#E6FF00`, noir `#0B0B0F`, rose `#FF2E63` | Anton + Inter | repris du site |
| Hébergements Insolites Vendôme | noir `#161616`, doré `#A07C3A` / `#C9A660`, crème `#F4EFE6` | Cormorant Garamond + Manrope (e-mail : Helvetica) | repris du site et de la campagne |
| Yellow Immo | jaune `#FDC704`, presque noir `#16161A` | Barlow Condensed + Poppins | repris du site |
| Speedy Pizz | logo noir | à définir | **à confirmer** : pas de site dans le dépôt |

## 9. Animation et page d'accueil

- Animation d'ouverture : plan de métro des villes autour de Vendôme en bleu clair, une loupe bleue passe de ville en ville et fait apparaître des contacts, glisse au centre et devient le logo qui efface le plan, puis « ACQUISITOR » et « Aucun contact ne lui échappe ». Le logo reste affiché environ 2 secondes.
- Page d'accueil acquisitor.fr : un seul écran comme controlator.fr, même animation, une phrase d'explication, « Bientôt ».

## 10. Droit (France, prospection d'entreprises)

- Prospection par e-mail d'entreprises autorisée sans accord préalable si le message concerne leur métier, indique qui écrit et d'où vient l'adresse, et offre un lien « ne plus recevoir ».
- Ne jamais vendre les contacts. Vendre le logiciel est possible (client responsable de ses contacts, Acquisitor sous-traitant : contrat de traitement des données).
- Conservation : Karl a choisi de tout garder. La CNIL recommande 3 ans sans réponse pour les contacts personnels : choix assumé par Karl, à revoir avant toute vente du logiciel.
