# Point d'étape ScantoRenov — 11 avril 2026

_Rédigé par Claude à partir des retours utilisateur sur le dashboard admin fraîchement redéployé (commit `252cfab`, deploy Netlify `69d9ba70f73bbf65a90209b7`)._

---

## 1. Dashboard admin

### 1.1 Anomalies constatées après la refonte Codex

| # | Sujet | Constat | Statut |
|---|---|---|---|
| D1 | Onglet **Plans** | Les plans initialement récupérés via l'API Matterport ne sont plus affichés. Seuls les PNG/PDF locaux sont visibles. | À corriger |
| D2 | Onglet **Dimensions** | Affiche les données issues de l'API Matterport au lieu de parser le CSV déposé dans le sous-dossier `dimensions/` du client. | À corriger |
| D3 | Bouton **Télécharger toutes les panoramiques** | Redondant : les panoramas sont déjà sur le PC dans le sous-dossier `panoramas/` du client. | À supprimer |
| D4 | Bouton **Transmettre à Marcel** | Aucun feedback visuel lors du clic : on ne sait ni si l'action est lancée, ni ce qu'elle fait. | À corriger (UX + retour explicite) |

### 1.2 Évolutions pipeline client

| # | Sujet | Spécification |
|---|---|---|
| P1 | Nouvelle étape **Paiement visite** | Insérer entre `Analyse prête` et `Avant-projet prêt`. |
| P2 | Bouton **Donner accès au client** | Afficher uniquement lorsque l'étape `Paiement visite` est validée. |
| P3 | Étape **Avant-projet prêt** | Reste en état "vert en cours" tant que le client travaille dessus avec Marcel. Passe en état "validé ✓" uniquement quand le client télécharge son PDF d'avant-projet. |

### 1.3 Refonte du bloc Marcel

- Le bloc **Marcel** doit être **visible en permanence** sur la fiche client.
- Il doit être **positionné sous chaque nouvelle étape franchie**, pour matérialiser le fait que chaque étape (depuis la demande de contact initiale) alimente son raisonnement.
- Objectif opérationnel : permettre de **constater la progression du raisonnement** de Marcel au fil des étapes validées.

### 1.4 Rappel des points déjà livrés (refonte Codex + merges)

- Bouton unique **Récupérer** (remplace la double action Synchroniser / Envoyer fichiers).
- Bloc **Gestion des fichiers** remonté sous le bloc "ID du modèle Matterport".
- Onglets refondus : `Iframe Matterport` / `Panoramas` / `Dimensions` / `Plans`.
- Actions `transmitMatterportToMarcel()` et `grantMatterportAccessToClient()` branchées.
- Suppression définitive du bouton "Synchroniser depuis Matterport".
- Chaîne d'upload end-to-end fonctionnelle : `admin-upload-file` → Supabase Storage → `admin-update-scan` → table `scans`.
- `admin-cockpit-data` remonte désormais `photos_urls` / `plans_urls` / `matterport_model_id` / `matterport_data` en jointure sur la table `scans`.
- `admin-update-scan` supporte `mode: 'replace'` et déduplique en mode merge.

---

## 2. Marcel (assistant IA)

- Un **script comportemental plus précis** devra être rédigé le moment venu.
- Pré-requis avant rédaction : figer le pipeline dashboard (§1.2 et §1.3) pour que le script Marcel puisse s'ancrer sur des étapes stables.

---

## 3. Espace personnel utilisateur

- **Refonte et réorganisation** à prévoir **après finalisation du dashboard admin**.
- Dépendance : le pipeline côté admin doit être stable pour que l'espace client puisse s'y aligner (statuts visibles, jalons, accès visite virtuelle, téléchargement d'avant-projet, etc.).

---

## 4. Design & charte graphique

- Finir la transformation du site démarrée selon `scantorenov_cadrage_visuel.docx`.
- Vérifier la cohérence visuelle entre l'espace admin, l'espace client, et les pages publiques une fois les refontes ci-dessus livrées.

---

## 5. Séquencement recommandé

1. **Dashboard — correctifs D1 à D4** (rapides, stabilisent l'état actuel).
2. **Dashboard — pipeline P1 à P3** (étape Paiement visite + logique de validation avant-projet).
3. **Dashboard — repositionnement du bloc Marcel** (UX majeure).
4. **Marcel** — script comportemental précis une fois le pipeline figé.
5. **Espace personnel utilisateur** — refonte complète.
6. **Design & charte** — passe visuelle finale.

---

## 6. Notes techniques pour la reprise

- **Source de vérité plans Matterport** : actuellement perdue côté rendu — vérifier que `matterport_data` (colonne `scans`) contient bien les URLs de plans renvoyées par l'API Matterport avant de reconstruire l'affichage côté onglet `Plans`.
- **Parsing CSV dimensions** : la logique existe déjà dans `netlify/functions/import-matterport.js`. À réutiliser côté dashboard pour produire un rendu canonique dans l'onglet `Dimensions`, avec fallback API si le CSV est absent.
- **Feedback Transmettre à Marcel** : ajouter un état de chargement + toast de confirmation/erreur dans `transmitMatterportToMarcel()` (admin-dashboard.html).
- **Étape Paiement visite** : impact sur `_admin-client-progress.js`, `_cockpit-engine.js`, et potentiellement une migration SQL pour enregistrer la validation (ou réutilisation de la table `payments` existante).
- **Validation Avant-projet au téléchargement** : ajouter un événement côté espace client qui appelle une fonction `mark-avantprojet-downloaded` et passe l'étape à "validée ✓".
