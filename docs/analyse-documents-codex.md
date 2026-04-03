# ANALYSE CRITIQUE DES 10 DOCUMENTS CODEX
## Poste de Pilotage Interne - ScantoRenov

**Date d'analyse :** 29 mars 2026
**Analyseur :** Claude Cowork - Opérationnel ScantoRenov
**Contexte :** Évaluation de la cohérence, faisabilité et adéquation au parcours réel

---

## SYNTHÈSE EXÉCUTIVE

Les 10 documents forment un **projet ambitieux et bien structuré** pour un cockpit opérateur de ScantoRenov. Ils progressive du général (vision) au particulier (dictionnaire de tâches et mapping d'événements).

**État global :** 75% cohérent, 20% à clarifier/itérer, 5% risqué.

---

## 1. DOCUMENT 1 : Proposition-poste-pilotage-interne.docx

### Résumé structuré

Ce document pose les **fondations conceptuelles** du poste de pilotage interne :
- Vision d'un cockpit personnel, simplifié, orienté action
- Rejet d'un back-office générique
- 7 écrans proposés (accueil/recherche, dossier client, panneau d'action, scan, Marcel, historique, vue globale)
- Rôle central de Marcel : consignation des synthèses, pas chat accessoire
- Données minimales recommandées (clients, admin_tasks, appointments, project_notes, scans, payments, knowledge_candidates)
- Plan de construction en 9 étapes

### Points forts

✓ **Clarté de vision** : "Chercher, ouvrir, comprendre, faire, valider, passer au suivant" est un mantra opérationnel solide
✓ **Simplicité affichée** : rejet explicite des formulaires lourds
✓ **Marcel bien positionné** : pas un accessoire, une vraie interface de synthèse
✓ **Données minimales bien pensées** : évite l'over-engineering
✓ **Recherche rapide** : 3 lettres pour auto-completion, 5-8 résultats

### Points faibles et risques

⚠️ **Vagueness on Marcel** : "consignation des synthèses" est encore peu défini. Quelles synthèses exactement ? Quand ? Avec quel garde-fou ?
⚠️ **Screen 7 (Vue globale)** : mentionnée vaguement. Quelle priorisation ? Quels filtres vraiment utiles ?
⚠️ **Automatisation Matterport** : la section 5 parle de "cote serveur" sans spécifier si c'est une dépendance critique ou optionnelle
⚠️ **Socle data** : minimaliste, mais manquent :
  - structure pour les preuves de validation d'onboarding (déjà mentionnée en section 5 des wireframes mais pas ici)
  - gestion des statuts de tâches distincts du statut client (problème soulevé plus tard dans les docs 8 et 10)
  - versioning des avant-projets (client vs interne)

### Cohérence interne

✓ Bon : tous les écrans proposés réapparaissent dans les wireframes détaillés
✓ Bon : plan de construction logique (recherche → génération tâches → Marcel → Matterport → validations)
⚠️ Manque : lien explicite entre "statut client" et "tâches operateur" (sera traité au doc 8)

---

## 2. DOCUMENT 2 : Wireframes-poste-pilotage-interne.docx

### Résumé structuré

Vue d'ensemble des wireframes généraux + cas d'usage détaillé post-appel téléphonique :
- Écran principal avec 3 colonnes (gauche contexte, centre action, droite Marcel)
- Bandeau haut avec recherche, compteurs, identité client
- Cas d'usage détaillé pour "après appel" avec :
  - Notes brutes + structuration Marcel
  - Cartes de validation (8 cartes)
  - Barre d'actions finale (4 chemins de sortie)

### Points forts

✓ **Architecture 3-colonnes réutilisable** : gauche (contexte stable), centre (travail), droite (intelligence)
✓ **Cartes de validation simples** : évite formulaires rigides, actionnable en 3 clics
✓ **Distinction notes brutes / Marcel** : permet opérateur de dicter librement avant structuration
✓ **Trois sorties métier claires** : intérêt confirmé / infos insuffisantes / dossier sans suite
✓ **Ce qu'il faut éviter** : section très utile (liste des pièges courants)

### Points faibles

⚠️ **Compteurs abstraits** : "À faire, En attente, À valider" sans spécifier la définition de chaque colonne (sera fait au doc 7)
⚠️ **Mini check-list colonne gauche** : 6 items pour "une colonne de lecture rapide". Risk : surcharge
⚠️ **Marcel mode compte-rendu** : "mode forcé" → comment bascule-t-il d'un mode à l'autre selon l'écran ?
⚠️ **Validation de synthèse** : pas clair si "Valider la synthèse d'appel" ferme une tâche operateur ou crée la suivante
⚠️ **Envoi email d'invitation** : mentionné "si demande" mais quand et comment décide-t-on ?

### Cohérence avec doc 1

✓ Bon : les 7 écrans deviennent concrets
✓ Bon : architecture 3-colonnes reprend l'idée d'action contextuelle
⚠️ Manque : lien entre "bouton principal Ouvrir Marcel" et les autres modes Marcel (synthèse, analyse, etc.)

---

## 3. DOCUMENT 3 : Wireframe-scan-completed.docx

### Résumé structuré

Écran détaillé pour le statut `scan_completed` :
- Intention : transformer un événement de terrain en dossier exploitable
- 5 blocs centraux : Source Matterport, Assets locaux, Aperçu scan, Observations, Décision de passage
- Cartes de validation (7 cartes) pour valider étape par étape
- Outputs système attendus : fichiers rattachés, CSV généré, contexte Marcel enrichi, tâche suivante créée

### Points forts

✓ **Flux clair** : Matterport → Assets → Aperçu → Observations → Passage
✓ **Cartes de validation** : Surface mesurée vs déclarée, qualité scan, photos prioritaires, etc. → actionnable
✓ **Distinction PC vs Matterport** : très important pour la transparence des données
✓ **Marcel en mode visite** : redacteur et structurant, pas simple chat
✓ **Trois sorties métier** : dossier complet / partiel / incoherent

### Points faibles

⚠️ **Synchronisation Matterport** : repose sur un "Synchroniser depuis Matterport" magique. Quid si la connexion échoue ? Fallback ?
⚠️ **CSV ScantoRenov** : "générer à partir des données récupérées" → quel format exactement ? Obligatoire ou optionnel ?
⚠️ **Observations de visite** : "notes de terrain" → quelle structure ? Libre ou formulaire guidé ?
⚠️ **Images prioritaires** : comment les marquer ? UI manquante
⚠️ **Statut du paiement** : apparaît dans checklist gauche mais aucune action sur ce bloc

### Cohérence avec docs 1-2

✓ Architecture 3-colonnes réutilisée
✓ Cartes de validation restent le modèle UX
⚠️ Manque : quand et comment le statut client passe-t-il de `scan_completed` à `analysis_ready` ? (doc 8 répondra)

---

## 4. DOCUMENT 4 : Wireframe-analysis-ready.docx

### Résumé structuré

Écran pour statut `analysis_ready` :
- Intention : passer de la collecte à l'exploitation, transformer en vision de projet
- 6 blocs d'atelier : Diagnostic, Intentions client, Scenarios, Programme de travaux, Supports visuels, Décision de sortie
- Marcel en mode analyse : co-analyste, redacteur, contradicteur
- 6 cartes de validation + barre finale
- Outputs système : analyse enregistrée, enrichissement Marcel, création tâche suivante

### Points forts

✓ **Atelier structuré** : 6 blocs logiques et exhaustifs (diagnostic → scenarios → programme → visuels → décision)
✓ **Marcel comme co-analyste** : meilleure position que simple chat
✓ **Questions residuelles** : concept intelligent pour tracer les incertitudes
✓ **Trois sorties metier** : solide / partielle / bloquée

### Points faibles

⚠️ **Vagueness sur scenarios** : "minimal, cible, ambitieux" → combien ? Format ? Estimations incluses ?
⚠️ **Supports visuels et hypotheses Marcel** : où viennent-ils ? Générés antérieurement ? À générer ici ?
⚠️ **Programme de travaux** : structuré comment ? Classes de priorité claires ? Dépendances formalisées ?
⚠️ **Limite entre analyse et avant-projet** : à quel seuil de maturité bascule-t-on ? Document ne le dit pas
⚠️ **Carte "Etat de preparation de l'avant-projet"** : avant même d'avoir fait l'avant-projet ? Confusion possible

### Cohérence avec docs 1-3

✓ Architecture 3-colonnes, cartes de validation restent le pattern
⚠️ **Rupture conceptuelle** : doc 3 parle de "transformer le scan" (action technique), doc 4 parle de "raisonner avec Marcel" (action strategique). Quid de l'utilisateur qui ne maîtrise ni la technique scan ni la stratégie projet ?

---

## 5. DOCUMENT 5 : Wireframe-avant-projet-ready.docx

### Résumé structuré

Écran pour statut `avant_projet_ready` :
- Intention : transformer intelligence produite en livrable transmissible
- 7 blocs : Vision d'ensemble, Programme finalisé, Hypothèses et limites, Supports visuels, Message client, Statut livraison, Décision de passage
- Marcel en mode synthèse finale
- 6 cartes de validation
- Trois sorties métier : transmis / à reprendre / converti en accompagnement

### Points forts

✓ **Bloc "Hypothèses et limites"** : excellente clarification de ce qui est confirmé vs indicatif
✓ **Distinction message interne / client** : crucial et souvent oublié
✓ **Trois sorties métier** : ouvre les suites possibles

### Points faibles

⚠️ **"Coherence générale du projet"** : carte très abstraite. Critères concrets ? Checklist ?
⚠️ **Avant-projet converti en accompagnement** : cette bascule n'était pas prévue dans le parcours ScantoRenov affiché (Formulaire → Compte → Parcours pédagogique → RDV → Scan → Marcel → Avant-projet). C'est nouveau et à valider
⚠️ **Statut de livraison : 3 états** : pret interne / transmettre / discuter RDV. Mais le flux réel ? Qui décide et quand ?
⚠️ **Visuels retenus** : d'où viennent-ils ? Générés en doc 4 ? À générer ici ?
⚠️ **Manque de clarté sur timing** : avant-projet est-il un moment ou un état durable ?

### Cohérence avec docs 1-4

⚠️ **Tension croissante** : docs 3-5 mélangent deux logiques :
  1. Traitement opérationnel du dossier (collectionner, valider)
  2. Décisions commerciales/stratégiques (scenarios, message client, accompagnement)

Ces deux n'ont pas le même rythme ni les mêmes acteurs.

---

## 6. DOCUMENT 6 : Wireframe-accompaniment-subscribed.docx

### Résumé structuré

Écran pour statut `accompaniment_subscribed` :
- Intention : piloter coordination active et mise en œuvre, pas simple avant-projet
- 6 blocs : Feuille de route, Tâches ScantoRenov, Attentes client, Décisions et arbitrages, RDV coordination, Décision de suite
- Marcel en mode coordination, pas analyse pure
- 6 cartes de validation
- Outputs : mise à jour plan, fermeture tâches, création suites

### Points forts

✓ **Pivot conceptuel clair** : passer de "production d'avant-projet" à "pilotage exécution"
✓ **Distinction tâches ScantoRenov vs attentes client** : crucial pour éviter confusion de responsabilités
✓ **Feuille de route comme artefact vivant** : logique agile et pragmatique
✓ **Blocages et risques** : nommés explicitement

### Points faibles

⚠️ **Qui peut souscrire à l'accompagnement ?** : avant-projet transmis ? Avant transmission ? Pas clair
⚠️ **Paiement ou accord** : document dit "paiement ou accord tracé" mais quelle preuve ? PayPal ? Check de signature ?
⚠️ **Bascule vers MOE** : mentionnée mais jamais définie. MOE = Maîtrise d'œuvre ? En quoi ça diffère de l'accompagnement ?
⚠️ **Responsable de coordination** : créé mais jamais mentionné avant. Qui ? Quelle formation ? Quels outils ?
⚠️ **Occurrences multiples de "accompaniment_coordinate"** : doc 10 en parlera, mais ici c'est magique

### Cohérence avec docs 1-5

⚠️ **Saut métier** : docs 1-5 parlent de ScantoRenov qui *produit* un avant-projet. Doc 6 parle d'accompagnement *client* qui exécute le projet. C'est un changement de rôle énorme non expliqué.

---

## 7. DOCUMENT 7 : Wireframe-vue-transverse-quotidienne.docx

### Résumé structuré

Écran d'entrée quotidien de l'opérateur :
- Vue transverse ≠ simple dashboard. C'est du travail actionnable
- 4 colonnes : À faire, À valider, En attente client, Bloqués
- Cartes de tâches autoporteuses (8 fields par carte)
- Barre haute avec recherche, compteurs, filtres, toggle personnel/équipe
- Priorisation par règles simples (retard → validation bloquante → valeur → confort)
- **Point critique** : distinction entre statut dossier et statut tâche (non doc)

### Points forts

✓ **Distinction statut dossier vs tâche** : insight crucial, mal traité avant
✓ **4 colonnes simples** : À faire / À valider / En attente / Bloqués = réalité opérationnelle
✓ **Cartes autoporteuses** : 8 fields = minimalisme actionnable
✓ **Priorisation explicite** : "En retard de 3 jours, Validation bloquante, RDV demain"
✓ **Regles de passage claires** : qui va où et pourquoi
✓ **Retour automatique** : après validation, retour à la vue transverse
⚠️ **Section 13 "Figer avant de développer"** : liste de 7 points critiques → preuve que cette vue était manquante dans la première proposition

### Points faibles

⚠️ **Liaison explicite tâche d'attente + tâche métier** : "plus tard il faudra" → pas codé
⚠️ **SLA et vieillissement** : mentionnés mais sans chiffres. 3 jours ? 7 jours ? Par type de tâche ?
⚠️ **Marcel dans la vue transverse** : très vague. "Demander à Marcel un recap du blocage" comment exactement ?
⚠️ **Cas d'usage concrets** : 4 exemples sont basiques. Quid des cas complexes ?
⚠️ **Schéma minimal recommandé** : struct est minimaliste. Manquent : proof_status, dependencies, owner_previous_state pour reouverture

### Cohérence avec docs 1-6

✓ Excellent : synthèse des patterns UX précédents (3-colonnes → 4-colonnes)
✓ **Correction apportée** : docs 1-6 supposaient un opérateur qui ouvre un dossier. Doc 7 dit "l'opérateur voit d'abord ses tâches"
⚠️ Tension : comment ces deux workflows s'articulent ? Flux détaillé manquant

---

## 8. DOCUMENT 8 : Matrice-statut-taches-preparation-dev.docx

### Résumé structuré

Matrice du cycle de vie complet :
- **Décision critique** : statut dossier ≠ tâche opérateur
- 10 statuts clients mappés → tâches générées + preuves + écrans cibles
- Structure minimale admin_tasks : 15 fields
- Preuves d'onboarding dans structure séparée (onboarding_step_validations)
- Transitions tâches explicitées
- Marcel ne remplace jamais validation humaine
- **Section 9** : ce qu'il faut figer avant développement

### Points forts

✓ **Matrice exhaustive** : tous les statuts couverts
✓ **Séparation onboarding** : stocker validations de steps ≠ statut client clever
✓ **Preuves concrètes** : "création du dossier, email émis, données minimales valides"
✓ **Structure admin_tasks** : 15 fields bien pensés
✓ **Regles de passage colonnes transverse** : très explicite
⚠️ **Section 10** : liste finale de 9 points à figer = acknowledgment que sans ça, dev = chaos

### Points faibles

⚠️ **onboarding_completed proof** : "4 étapes validées" → lesquelles ? Nommées ? Structure sécurisée ?
⚠️ **call_requested vs call_done** : distinction fine mais pas évidente. Quand basculer ? Manually only ?
⚠️ **scan_scheduled vs scan_payment_completed** : deux statuts pour une même attente client (le paiement). Pourquoi deux ?
⚠️ **analysis_ready vs before_projet_ready** : tiret typo important. Quid vraiment ? "Analyse suffisamment riche" vs "avant-projet prêt à transmettre" = deux moments différents ?
⚠️ **accompaniment_subscribed vs in progress** : doc dit "le client a choisi l'accompagnement" mais pas "en train de suivre l'accompagnement". Longevity ?

### Cohérence avec docs 1-7

✓ Synthèse et structuration de tous les wireframes précédents
✓ **Correction importante** : doc 1 supposait une logique simple de statuts. Doc 8 ajoute la logique de tâches = architecture vraie

---

## 9. DOCUMENT 9 : Dictionnaire-task-types-preparation-dev.docx

### Résumé structuré

Dictionnaire détaillé de 20 task.types :
- Pour chaque type : but, declencheur, propriétaire, preuve de sortie, écran cible, priorité, transitions
- Règles de conception :
  - Une tâche ≠ un simple état système
  - Preuve de sortie observable
  - Transitions de tâche indépendantes du statut dossier
- Exemples : lead_review, phone_call_prepare, scan_assets_sync, analysis_build, accompaniment_coordinate, blocker_resolve, etc.

### Points forts

✓ **20 types bien définis** : chacun a un but clair et observable
✓ **Propriétaires assignés** : "chef_projet", "système", "responsable coordination"
✓ **Transitions explicites** : open → done, awaiting_validation, waiting_client, blocked, cancelled
✓ **Cardinality clair** : "apparition multiple autorisée" (ex : accompaniment_coordinate peut avoir N occurrences)
✓ **Garde-fou Marcel** : "Marcel ne remplace jamais la validation humaine"
✓ **Recommandation finale** : "dictionnaire devra devenir la reference commune"

### Points faibles

⚠️ **Propriétaires = rôles, pas personnes** : "chef_projet" c'est qui au jour J ? Vanessa ? Une équipe ? Pas clair
⚠️ **Preuves de sortie parfois vagues** :
  - lead_review : "dossier minimal valide ou motif de rejet" → quels critères pour "valide" ?
  - onboarding_validate_proof : "quatre validations d'étapes" → les noms de ces 4 étapes ?
  - analysis_build : "analyse structurée produite" → quelle structure ? JSON ? Markdown ? HTML ?

⚠️ **Types manquants** :
  - Relance générique (rappel client, email rappel)
  - Gestion des paiements partiels ou échelonnés
  - Escalade (quand un opérateur dit "ça dépasse ma compétence")
  - Validation qualité QA avant transmission client
  - Handling de rejets de synthèse ou d'analyse

⚠️ **Transitions incomplètes** :
  - cancel vs done : quand quitter un dossier sans suite ?
  - blocked → open : qui décide que c'est levé ? Comment le système sait-il ?

⚠️ **Propriétaire par défaut** : que faire si ce propriétaire est absent / débordé / en congé ?

### Cohérence avec docs 1-8

✓ Opérationnel : chaque type est linkable à au moins un écran précédent
⚠️ **Manque** : et si un opérateur doit créer une tâche ad-hoc (urgence, cas spécial) ? Aucun type pour ça

---

## 10. DOCUMENT 10 : Mapping-evenements-cycle-taches-preparation-dev.docx

### Résumé structuré

Mapping événement système → cycle de vie tâches :
- **Règle clé** : événement ≠ statut dossier ≠ tâche
- Moteur de tâches : événement → création / fermeture / reouverture
- 35+ événements mappés (contact_submitted, identity_account_created, phone_appointment_booked, scan_payment_completed, analysis_draft_saved, accompaniment_activated, client_reply_received, blocker_detected, etc.)
- **Idempotence critique** : un événement ne crée jamais de doublon
- Reouverture : restaure l'état précédent

### Points forts

✓ **35+ événements couverts** : exhaustif et réaliste
✓ **Idempotence explicite** : "un même événement ne doit jamais créer plusieurs tâches ouvertes identiques"
✓ **Restauration d'état** : "le système devra mémoriser l'état précédent pour savoir comment rouvrir proprement"
✓ **Séquences claires** :
  - contact_submitted → lead_review
  - phone_call_completed → phone_call_complete (open) puis phone_summary_validate (awaiting_validation)
  - scan_assets_synced → visit_summary_validate (awaiting_validation)
  - analysis_validated → avant_project_finalize (open)

✓ **Événements transverses** : client_reply_received, blocker_detected, blocker_resolved, marcel_output_proposed, etc.
✓ **Section 10 "Regles à figer"** : checklist de 6 points = scope complet

### Points faibles

⚠️ **Liens entre tâches d'attente et métier** : "plus tard il faudra une liaison explicite" → pas encore fait
⚠️ **Événement vs fonction** : confusion possible :
  - contact_submitted = événement ou action du formulaire ?
  - phone_call_completed = événement système ou action opérateur ?
  - scan_assets_synced = événement système ou action opérateur confirmant la sync ?

⚠️ **Preuve d'événement** : comment le système sait-il qu'un événement a vraiment eu lieu ?
  - phone_call_completed : qui émet ? L'opérateur ? Un CRM webhook ? Timing ?
  - client_reply_received : email parser ? Formulaire ? Appel ?

⚠️ **Événements sans proof de sortie** :
  - onboarding_step_validated : "une preuve de progression est stockée" → par qui ? Quand ? Async ?
  - scan_assets_synced : si Matterport API échoue, c'est quoi l'événement ? sync_partially_failed ?

⚠️ **Reouverture de tâches** :
  - visit_summary_validate refusée → scan_assets_sync se rouvre. Mais l'opérateur a-t-il besoin d'ajouter des assets ? Unclear
  - analysis_build refusée → visit_summary_validate se rouvre. Mais pourquoi ? L'analyse manque de contexte ?

⚠️ **Marcel output_rejected** : "motif de refus consigné et prochain retravail explicite". Explicitant comment ?

⚠️ **Événement de timing** : aucun événement basé sur timing/delay. Quid du `client_reply_missing_sla` auto-créé ? Qui l'émet ? Un job batch ? Quand ?

### Cohérence avec docs 1-9

✓ Synthèse et ciment de tous les éléments précédents
✓ **Apport nouveau** : logique d'événements entrelace tous les concepts précédents (statuts, tâches, écrans, Marcel)
⚠️ **Complexité croissante** : docs 1-3 = UX simple. Docs 8-10 = architecture système complexe. Risque : dev dépasse UX

---

## ANALYSE TRANSVERSALE PAR THÈMES

### THÈME 1 : Architecture et Parcours Client

**Parcours documenté (docs 1-6)** :
1. Formulaire
2. Création compte (Identity)
3. Parcours pédagogique obligatoire (onboarding_completed)
4. RDV téléphonique (call_done)
5. Scan (scan_completed)
6. Analyse (analysis_ready)
7. Avant-projet (avant_projet_ready)
8. **NOUVEAU** : Accompagnement (accompaniment_subscribed)

**Coherence avec brief initial** :
- Brief dit : Formulaire → Compte → Parcours pédagogique → RDV → Scan → Marcel → Avant-projet
- Docs proposent la même chose **+ Accompagnement comme étape optionnelle**
- **Question non résolue** : accompagnement est-il une suite logique ? Une alternative ? Commercialement c'est quoi ?

---

### THÈME 2 : Marcel (IA Anthropic)

**Rôles définis dans les documents** :

| Phase | Mode | Rôle | Garde-fou |
|-------|------|------|-----------|
| Après appel | compte-rendu d'appel | Synthétiser notes brutes | Opérateur valide avant stockage |
| Après visite | compte-rendu de visite | Structurer observations | Opérateur valide avant stockage |
| Analyse | co-analyste | Proposer scenarios, contraintes, priorités | Opérateur arbitre |
| Avant-projet | synthèse finale | Reformuler, distinguer interne/client | Opérateur approuve |
| Accompagnement | coordination | Recap, feuille de route, risques | Opérateur valide |
| Transverse | assistant pilotage | Recap blocage, relance client préparée | Opérateur approuve avant envoi |

**Cohérence** : ✓ Marcel a des rôles distincts par phase, c'est bon
**Risques** :
- ⚠️ Jamais de publication sans validation humaine (stipulé partout, mais qui contrôle ?)
- ⚠️ "Lecons globales candidates" en attente de file de validation distincte (doc 1 section 6) → jamais implémentée dans docs 3-10
- ⚠️ Marcel peut proposer mais pas décider ; qui est "décideur par défaut" ? L'opérateur ? Un responsable ?

---

### THÈME 3 : Validation et Preuves

**Modèle de validation** : Cartes simples (3 actions : Valider, Corriger, Laisser vide / Reporter)

**Types de preuves** :
- Événements système (paiement reçu, appointment créé, scan visité)
- Contenus structurés (synthèse d'appel validée, observations stockées, analyse approuvée)
- Fichiers (photos, plans, CSV, iframe)
- Logs (email envoyé, transmission journalisée)

**Coherence** : ✓ Concept de "preuve attendue" bien intégré dans docs 8-10
**Risques** :
- ⚠️ Définition de preuve vague dans certains task.types
- ⚠️ Pas de schéma de versioning (synthèse v1, v2, v3 ?)
- ⚠️ Pas de audit trail complet (qui a validé, quand, depuis quel écran ?)

---

### THÈME 4 : États et Transitions

**États de tâches (doc 8-10)** : open, awaiting_validation, waiting_client, blocked, done, cancelled

**Transitions problématiques** :
1. awaiting_validation → open : qui fait ce rejet ? Quelle interface ?
2. blocked → open : qui détecte la levée ? Automatique ou manuel ?
3. waiting_client → open : quand repassent en priorité ? SLA seulement ?
4. done : à quel moment archiver ? Garder 3 mois ? 1 an ?

**Coherence** : ✓ États clairs dans doc 8, transitions dans doc 10
**Risques** :
- ⚠️ Pas de timeline sur "si pas de retour client après 7 jours, → waiting_client expirée"
- ⚠️ État "cancelled" rarement utilisé ; quid des dossiers sans suite ?

---

### THÈME 5 : Automatisation et Manuel

**Automatisation envisagée (doc 1 section 5)** :
- Matterport : récupération côté serveur (modelId, locations, rooms, dimensions, floorplans)
- iframe automatisée à partir de modelId
- Screenshots via Showcase SDK
- CSV généré

**Manuel requis (toujours)** :
- Création et validation de tâches
- Validation de synthèses, analyses, avant-projets
- Arbitrage sur scenarios
- Transmission client

**Coherence** : ✓ Boundary clairement posée
**Risques** :
- ⚠️ Matterport API : niveaux d'accès non confirmés, Property Intelligence supposée "à confirmer"
- ⚠️ Pas de gestion des erreurs Matterport (modelId invalide, account expiré, rate limit)
- ⚠️ Clés Matterport "côté serveur" = dépendance ops/infra non documentée

---

### THÈME 6 : Données et Structuration

**Socle data minimal (doc 1 section 7)** :
- clients : identité, statut, phase, métadonnées
- admin_tasks : 15 fields (doc 8)
- appointments : téléphone, scan, accompagnement
- project_notes : synthèses, observations, rapports
- scans : modelId, iframe, données Matterport, assets
- payments : scan, visite, accompagnement
- knowledge_candidates : leçons en attente de validation

**Séparation intelligente (doc 8)** :
- onboarding_step_validations : preuve par step (pas explosion de statuts)

**Coherence** : ✓ Structure logique et évite redondance
**Risques** :
- ⚠️ project_notes : un seul format (JSON ? Markdown ? HTML ?) Pour stocker synthèses, observations, rapports ?
- ⚠️ knowledge_candidates : jamais integré dans les tâches. Comment devient-il un savoir global ?
- ⚠️ Versioning : aucune table history / audit trail
- ⚠️ Intégration Identity : comment les users Netlify linkent-ils à `clients.id` ?

---

### THÈME 7 : UI/UX Pattern

**Pattern dominant** : 3 colonnes + 4-colonnes transverse

**Réutilisations** :
- Écrans métier (docs 2-6) : Gauche (contexte) / Centre (action) / Droite (Marcel)
- Vue transverse (doc 7) : À faire / À valider / En attente / Bloqués

**Cohérence** : ✓ Pattern réutilisé = familiarité
**Risques** :
- ⚠️ Très dense. 3 colonnes + bandeau haut + barre bas = beaucoup à scroller
- ⚠️ Pour petits écrans (tablet, mobile) : responsive ? Aucune mention
- ⚠️ Cartes de validation : si 7-8 cartes, l'opérateur peut-il les valider toutes en 5 min ?

---

## ÉVALUATION CRITIQUE PAR PILIER

### PILIER 1 : Faisabilité Développement

**Score** : 7/10

✓ Specifications suffisamment détaillées (docs 8-10)
✓ Événements et transitions explicités
✓ Données minimales claires

⚠️ Dev dépendra d'une architecture événementielle solide (pas triviale)
⚠️ Matterport intégration = dépendance externe (risque)
⚠️ Marcel intégration = dépendance Anthropic API (risque)
⚠️ Pas de schema SQL, pas de API spec OpenAPI, pas de service decomposition

---

### PILIER 2 : Adéquation Parcours Client Réel

**Score** : 6/10

✓ Parcours cover les 7 étapes du brief
✓ Validation progressive (onboarding, appel, scan, analyse, avant-projet)

⚠️ Accompagnement = nouveau et pas bien intégré au brief initial
⚠️ Où est la **monétisation** dans les docs ? Paiement scan, paiement accompagnement… comment le système gère ?
⚠️ Où est l'**escalade commerciale** ? Un opérateur dit "ce client mérite un suivi premium" → qui décide quoi ?
⚠️ Où est la **relance client** systématique ? onboarding_nudge existe mais très générique

---

### PILIER 3 : Opérabilité Quotidienne

**Score** : 8/10

✓ Vue transverse = entrée naturelle pour opérateur
✓ Tâches autoporteuses = actionnable sans contexte full
✓ Marcel assistive = gain temps réel sur synthèses

⚠️ **Surcharge cognitive possible** :
  - Opérateur doit vérifier onboarding_completed
  - Puis préparer appel téléphonique
  - Puis valider synthèse d'appel
  - Puis valider observations
  - Puis produire analyse
  - Puis finaliser avant-projet
  - Puis potentiellement piloter accompagnement

C'est 8 rôles différents pour 1 personne ! Comment gérer ?

⚠️ **Priorités** : doc 7 dit "5 règles simples" mais quoi si deux règles en conflit ?

---

### PILIER 4 : Risques et Dépendances

**Score** : 5/10

**Risques critiques identifiés** :

1. **Matterport intégration** (docs 1, 3, 10)
   - ⚠️ Quid si client passe un lien autre que Matterport ? (Ricoh, DJI, etc.)
   - ⚠️ Quid si Matterport API est down ?
   - ⚠️ Pas de fallback manual upload visible

2. **Marcel validation** (partout)
   - ⚠️ Quid si opérateur approuve synthèse dangereuse (promesse impossible, données confidentielles) ?
   - ⚠️ Pas de garde-fou automatique

3. **Matures opérateur** (docs 3-6)
   - ⚠️ Docs supposent que opérateur peut :
     - Évaluer qualité d'un scan Matterport
     - Diagnostiquer un projet de rénovation
     - Analyser faisabilité et budget
   - ⚠️ C'est impossible sans formation spécialisée

4. **Intégration Identity** (doc 8-10)
   - ⚠️ Comment le système connaît-il qu'un `identity.id` correspond à quel `clients.id` ?
   - ⚠️ Pas de mapping documenté

5. **Événements timing** (doc 10)
   - ⚠️ client_reply_missing_sla = événement qui n'existe pas dans le système
   - ⚠️ Quid si client répond mais sur le mauvais canal (SMS vs email vs appel) ?

---

## INCOHÉRENCES ET RUPTURES MAJEURES

### Incohérence 1 : Statut Dossier vs Tâche

**Doc 1-2** : supposent un opérateur qui ouvre un dossier et fait une action immédiate

**Doc 7-8** : disent "un dossier peut avoir plusieurs tâches actives simultanément"

**Exemple pratique** :
- Dossier est en statut `call_requested` (1 seul)
- Mais il y a 3 tâches ouvertes : phone_call_prepare, onboarding_nudge (reouverte), blocker_resolve (paiement en attente)

**Question non résolue** : un opérateur ouvre le dossier via vue transverse. Quel écran voit-il ? phone_call_prepare ? Les 3 tâches ? Un dashboard des tâches ?

**Recommandation** : créer un écran "dossier multi-tâches" qui montre toutes les tâches actives du dossier et laisse l'opérateur choisir laquelle traiter d'abord.

---

### Incohérence 2 : Avant-projet comme Moment vs État Durable

**Doc 4** : analyse_ready = "contexte riche, prêt à produire analyse"
**Doc 5** : avant_projet_ready = "avant-projet mature, prêt à transmettre"

**Flou** : qu'est-ce qui se passe APRÈS transmission ? Le dossier reste avant_projet_ready ? Passe-t-il à un statut "transmitted" ? "client_review" ?

**Exemple pratique** :
- Avant-projet transmis au client le 10 mars
- Client pose une question le 15 mars
- Opérateur rouvre l'avant-projet pour clarifier
- Statut dossier revient à avant_projet_ready ? Ou nouveau statut ?

**Recommandation** : ajouter des statuts :
- avant_projet_ready → avant-projet interne mature
- avant_projet_transmitted → avant-projet envoyé au client
- avant_projet_reviewed → client a lûle avant-projet et posé des questions

---

### Incohérence 3 : Deux Logiques de Travail Confondues

**Logique 1 : Collecte et Structuration** (docs 3-4)
- Récupérer le scan
- Enregistrer observations
- Produire analyse
- C'est du travail INTERNE d'équipe ScantoRenov

**Logique 2 : Décisions et Communication** (docs 4-6)
- Arbitrer scenarios
- Générer avant-projet
- Transmettre au client
- Piloter accompagnement client
- C'est du travail CLIENT-FACING et COMMERCIAL

**Problème** : les docs les mélangent comme si un seul opérateur faisait les deux

**Exemple concret** :
- Docs disent : "Opérateur ouvre le dossier scan_completed et traite Matterport"
- Puis : "Opérateur decide scenario client et arbitre budget"
- Mais : compétences très différentes !

**Recommandation** : créer deux rôles distincts :
- **Data operator** : gère scan, Matterport, assets, observations (technique)
- **Project manager** : arbitre scenarios, analyse, avant-projet, client (stratégie)

Ceux deux peuvent être la même personne pour petits dossiers, mais les écrans et tâches doivent être séparées.

---

### Incohérence 4 : Accompagnement Apparaît Tardivement

**Docs 1-5** : jamais mentionné avant
**Doc 5 section 3** : soudainement "offre d'accompagnement" existe et est proposée
**Doc 6** : cockpit entier dédié à accompagnement

**Questions non résolues** :
- Quand on propose l'accompagnement ? Juste après avant-projet ? Pendant ?
- Qui le décide ? Client ? Opérateur ? Commercial ?
- Est-ce facultatif ou obligatoire ?
- Quelle est la marge pour ScantoRenov ?
- Comment se termine l'accompagnement ? Client recrute un MOE ? ScantoRenov devient MOE ?

**Recommandation** : ajouter un document dédié au modèle commercial d'accompagnement (prix, durée, livrables, exit criteria).

---

### Incohérence 5 : "Leçons Globales Candidates" Jamais Mises en Œuvre

**Doc 1 section 6** : "Marcel propose des apprentissages globaux, dans une file de validation distincte"

**Docs 3-10** : cette file n'apparaît jamais. Les "leçons globales candidates" ne deviennent pas des tâches

**Question** : comment fonctionne la boucle d'apprentissage de Marcel ?

**Recommandation** : soit ajouter un task.type `knowledge_validation`, soit supprimer cette feature car elle n'est pas implémentée.

---

### Incohérence 6 : Propriétaires et Rôles Jamais Clarifiés

**Doc 9** : "chef_projet", "système", "responsable coordination"

**Questions** :
- Vanessa est chef_projet ? Oui/Non/Parfois ?
- Si Vanessa est en congé, qui prend les tâches ?
- "Système" = quelles tâches ? Les automatisées ?
- "Responsable coordination" = c'est qui ?

**Recommandation** : créer une matrice RACI avec rôles réels + noms + délégation.

---

## RECOMMANDATIONS PAR PRIORITÉ

### P1 : CRITIQUE - À Fixer Avant Dev

1. **Schéma de données SQL/Firestore** : aucun document ne propose de schéma. Essential pour dev.

2. **Événements système exhaustifs** : doc 10 en liste 35+ mais incomplet. Manquent:
   - Événements de timing (batch jobs)
   - Événements de correction (opérateur corrige une synthèse)
   - Événements de génération visuelle (quand les visuels sont générés ?)

3. **Rôles et propriétaires réels** : clarifier qui fait quoi (RACI matrix)

4. **Intégration Identity** : documenter comment un compte Netlify devient un client ScantoRenov

5. **Gestion des erreurs Matterport** : fallback si API échoue

### P2 : IMPORTANT - À Clarifier Avant Sprint 1

6. **Responsive design** : comment les écrans s'adaptent à mobile/tablet ?

7. **Escalade et SLA** : délais explicites pour attentes client

8. **Versioning** : comment gérer plusieurs versions d'une analyse ou avant-projet ?

9. **Audit trail** : qui a validé quoi et quand ?

10. **Monétisation** : intégration des paiements (Stripe ?)

### P3 : UTILE - À Ajouter Plus Tard

11. **Bulk operations** : comment gérer 5 dossiers à la fois ? Batch actions ?

12. **Reporting** : tableaux de bord pour business (# dossiers par phase, conversion rate, temps moyen par étape)

13. **Collaborations** : plusieurs opérateurs sur 1 dossier ?

14. **Templates** : emails templates, documents templates

15. **Integrations** : Slack ? Email ? CRM tiers ?

---

## POINTS FORTS GLOBAUX

✓ **Vision claire et cohérente** : du formulaire initial à l'accompagnement client
✓ **Pattern UX réutilisable** : 3-colonnes, cartes de validation, vue transverse
✓ **Marcel bien intégré** : pas un accessoire, un vrai rôle opérationnel
✓ **Tâches documentées** : 20 task.types, transitions explicites, événements listés
✓ **Preuves et validations** : rien n'est écrit sans validation humaine
✓ **Distinction statut dossier vs tâche** : conceptuel breakthrough au doc 7

---

## POINTS FAIBLES GLOBAUX

⚠️ **Surcharge d'un seul opérateur** : 8 rôles distincts, c'est trop pour 1 personne
⚠️ **Dépendances critiques non résolues** : Matterport, Identity, Marcel
⚠️ **Pas de schéma de données** : impossible de développer sans ça
⚠️ **Modèle commercial flou** : accompagnement apparaît sans cadre commercial
⚠️ **Risque de complexité système** : docs 8-10 = architecture événementielle complexe, facile de faire des bugs
⚠️ **Pas de metriques** : comment mesurer le succès du cockpit ?

---

## CONCLUSION

**Les 10 documents forment un projet UX et opérationnel solide, mais architecturalement incomplet pour la mise en œuvre.**

### État de readiness:

- **UX** : 80% (écrans bien pensés, patterns réutilisés)
- **Specifications fonctionnelles** : 70% (tâches documentées, mais événements à affiner)
- **Specifications techniques** : 30% (pas de schéma, pas d'API, pas d'architecture)
- **Readiness commercial** : 50% (accompagnement flou, pricing inconnu)

### Prochaines étapes recommandées :

**AVANT développement** :
1. ✓ **Schéma de données** : SQL / Firestore, avec audit trail
2. ✓ **API spec OpenAPI** : pour chaque fonction (create_task, validate_task, sync_matterport, etc.)
3. ✓ **Diagramme d'architecture** : events → functions → database → UI
4. ✓ **Integration plan Matterport** : fallbacks, error handling, rate limits
5. ✓ **Integration plan Identity** : how signup becomes client
6. ✓ **RACI matrix** : real roles, names, backups

**PENDANT développement** :
7. ✓ **Itérer sur events** : à chaque feature nouvelle, vérifier que events sont complets
8. ✓ **Mocker Marcel** : avant d'intégrer l'API réelle, mocker les réponses
9. ✓ **Tester transitions** : edge cases (validation refusée, blocage, etc.)

**APRÈS MVP** :
10. ✓ **Reporting dashboard** : pour tracer la performance du cockpit
11. ✓ **User testing** : avec 3-5 opérateurs réels, combien de temps par dossier ?

---

**Analyse complétée.**
