param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\matrice-statut-taches-preparation-dev.docx')
)

$ErrorActionPreference = 'Stop'

function Escape-Xml {
  param([string]$Text)
  if ($null -eq $Text) { return '' }
  return [System.Security.SecurityElement]::Escape($Text)
}

function New-BlankParagraphXml {
  return '<w:p/>'
}

function New-ParagraphXml {
  param(
    [string]$Text,
    [switch]$Bold,
    [int]$Size = 22
  )

  $escaped = Escape-Xml $Text
  $rPrParts = New-Object System.Collections.Generic.List[string]
  if ($Bold) { [void]$rPrParts.Add('<w:b/>') }
  if ($Size -gt 0) {
    [void]$rPrParts.Add("<w:sz w:val=`"$Size`"/>")
    [void]$rPrParts.Add("<w:szCs w:val=`"$Size`"/>")
  }

  $rPr = ''
  if ($rPrParts.Count -gt 0) {
    $rPr = "<w:rPr>$($rPrParts -join '')</w:rPr>"
  }

  return "<w:p><w:pPr><w:spacing w:after=`"120`"/></w:pPr><w:r>$rPr<w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Content
  )

  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$title = 'Matrice statut -> taches -> preuves -> ecran cible'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : preparer le futur developpement du poste de pilotage interne en figeant une matrice de travail a partir du pipeline technique actuel, du phasage UX et de la logique de validation par etapes."),
  (New-ParagraphXml -Text "Documents reconsultes pour construire cette matrice : Phasage-UX.docx et UX_validation-parcours-par-etapes.docx."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Decision de cadrage a retenir' -Bold -Size 28),
  (New-ParagraphXml -Text "Le dossier client et la tache operateur ne sont pas la meme chose. Le statut client indique ou en est le dossier dans son parcours. Les taches indiquent ce qu'un operateur doit faire, valider, attendre ou debloquer."),
  (New-ParagraphXml -Text "Conclusion : la vue transverse et le poste de pilotage interne devront reposer sur une logique `admin_tasks`, et non uniquement sur `clients.status`."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Pipeline technique actuel et traduction metier' -Bold -Size 28),
  (New-ParagraphXml -Text "- new_lead, account_created, onboarding_completed, call_requested = bloc metier visiteur / demandeur."),
  (New-ParagraphXml -Text "- call_done, scan_scheduled = bloc metier prospect interesse."),
  (New-ParagraphXml -Text "- scan_payment_completed, scan_completed, analysis_ready, avant_projet_ready = bloc metier client / avant-projet."),
  (New-ParagraphXml -Text "- accompaniment_subscribed = bloc metier client accompagne."),
  (New-ParagraphXml -Text "Recommandation : conserver ces statuts techniques en base pour la granularite systeme, mais afficher des macro-phases metier plus lisibles dans l'interface."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Regle specifique issue du document UX_validation' -Bold -Size 28),
  (New-ParagraphXml -Text "Le statut `onboarding_completed` ne doit pas signifier un simple passage sur une page. Il doit signifier que le prospect a valide un parcours de decouverte par etapes avec preuve de progression."),
  (New-ParagraphXml -Text "Recommandation forte : ne pas creer un statut client par sous-etape d'onboarding. Stocker ces validations dans une structure separee, par exemple `onboarding_step_validations`, rattachee au client."),
  (New-ParagraphXml -Text "Champs minimaux recommandes pour cette preuve : client_id, step_key, validation_type, proof_payload, completed_at."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Etats recommandes pour les taches operateur' -Bold -Size 28),
  (New-ParagraphXml -Text "- open : actionnable maintenant."),
  (New-ParagraphXml -Text "- awaiting_validation : quelque chose est produit mais doit etre valide humainement."),
  (New-ParagraphXml -Text "- waiting_client : rien ne peut avancer sans retour ou piece du client."),
  (New-ParagraphXml -Text "- blocked : blocage interne, technique, metier ou fournisseur."),
  (New-ParagraphXml -Text "- done : tache terminee."),
  (New-ParagraphXml -Text "- cancelled : tache abandonnee ou devenue sans objet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Structure minimale recommandee pour admin_tasks' -Bold -Size 28),
  (New-ParagraphXml -Text "Je recommande de figer avant toute production une structure minimale du type :"),
  (New-ParagraphXml -Text "id, client_id, type, title, status, priority, due_at, owner, expected_proof, blocking_reason, screen_target, created_from, created_at, updated_at, completed_at."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Matrice de generation par statut client' -Bold -Size 28),
  (New-ParagraphXml -Text 'Statut : new_lead' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : formulaire recu, visiteur / demandeur connu du systeme."),
  (New-ParagraphXml -Text "- Taches generees : verifier anomalies de lead si besoin ; relance creation de compte si pas de conversion apres delai cible."),
  (New-ParagraphXml -Text "- Preuves attendues : creation du dossier ; email de contact ou invitation emis ; donnees minimales valides."),
  (New-ParagraphXml -Text "- Ecran cible : Lead intake / qualification initiale."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire si anomalie ou relance ; sinon pas de tache humaine immediate."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : account_created' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : compte cree, mais parcours de decouverte ou qualification non encore complet."),
  (New-ParagraphXml -Text "- Taches generees : surveiller stagnation ; relance onboarding si l'utilisateur n'avance pas apres delai cible."),
  (New-ParagraphXml -Text "- Preuves attendues : compte Identity cree ; premiere connexion eventuelle ; acces a l'espace personnel possible."),
  (New-ParagraphXml -Text "- Ecran cible : suivi onboarding / qualification."),
  (New-ParagraphXml -Text "- Type de colonne transverse : En attente client par defaut ; A faire si relance decidee."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : onboarding_completed' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : parcours de decouverte valide avec preuve de progression ; prospect suffisamment engage pour acceder au RDV telephone."),
  (New-ParagraphXml -Text "- Taches generees : attendre la prise de RDV ; relance douce si aucun RDV demande dans le delai fixe."),
  (New-ParagraphXml -Text "- Preuves attendues : 4 etapes validees ; preuve de travail stockee par etape ; bouton final de prise de RDV debride."),
  (New-ParagraphXml -Text "- Ecran cible : cockpit qualification / suivi onboarding."),
  (New-ParagraphXml -Text "- Type de colonne transverse : En attente client par defaut."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : call_requested' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : un rendez-vous telephone est demande ou programme."),
  (New-ParagraphXml -Text "- Taches generees : preparer l'appel ; conduire l'appel ; valider la synthese post-appel."),
  (New-ParagraphXml -Text "- Preuves attendues : appointment telephone present ; date/heure connues ; contexte client accessible ; compte-rendu ou synthese produite apres appel."),
  (New-ParagraphXml -Text "- Ecran cible : ecran apres appel telephonique."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire avant et pendant l'appel ; A valider juste apres."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : call_done' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : l'appel est termine et la qualification permet de proposer le scan."),
  (New-ParagraphXml -Text "- Taches generees : valider la synthese d'appel ; envoyer l'invitation scan ; suivre la conversion vers la prise de RDV scan."),
  (New-ParagraphXml -Text "- Preuves attendues : synthese validee ; besoins identifies ; budget/echeance clarifies ; email invitation scan emis."),
  (New-ParagraphXml -Text "- Ecran cible : ecran post-appel / decision."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A valider puis A faire."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : scan_scheduled' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : un creneau de scan existe, mais le paiement ou la confirmation finale peuvent encore manquer."),
  (New-ParagraphXml -Text "- Taches generees : suivre le paiement ; verifier la logistique du scan ; relancer si non-paiement ou doute sur le creneau."),
  (New-ParagraphXml -Text "- Preuves attendues : appointment scan present ; lien de paiement ou session de checkout emis ; informations pratiques de visite disponibles."),
  (New-ParagraphXml -Text "- Ecran cible : suivi scan & paiement."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire ou En attente client selon le paiement."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : scan_payment_completed' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : paiement du scan recu, visite confirmee, dossier officiellement engage en avant-projet."),
  (New-ParagraphXml -Text "- Taches generees : confirmer le scan ; preparer la visite ; verifier envoi des confirmations au client et a l'equipe."),
  (New-ParagraphXml -Text "- Preuves attendues : paiement enregistre ; email de confirmation envoye ; appointment confirme."),
  (New-ParagraphXml -Text "- Ecran cible : pre-scan operations."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : scan_completed' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : la visite a eu lieu ; il faut transformer le scan en dossier exploitable."),
  (New-ParagraphXml -Text "- Taches generees : synchroniser Matterport ; rattacher photos/plans/CSV ; valider les observations de visite ; contextualiser Marcel."),
  (New-ParagraphXml -Text "- Preuves attendues : modelId ou iframe ; donnees scan presentes ; fichiers relies au client ; compte-rendu de visite valide."),
  (New-ParagraphXml -Text "- Ecran cible : ecran scan_completed / traitement du scan."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire puis A valider."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : analysis_ready' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : le contexte est suffisamment riche pour produire l'analyse et cadrer l'avant-projet."),
  (New-ParagraphXml -Text "- Taches generees : produire l'analyse ; arbitrer les scenarios ; preparer le programme de travaux ; valider la sortie vers avant-projet."),
  (New-ParagraphXml -Text "- Preuves attendues : analyse enregistree ; hypotheses explicitees ; scenario retenu ; questions residuelles identifiees."),
  (New-ParagraphXml -Text "- Ecran cible : ecran analysis_ready / atelier d'analyse."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire puis A valider."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : avant_projet_ready' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : l'avant-projet est mature et doit etre finalise, valide et potentiellement transmis."),
  (New-ParagraphXml -Text "- Taches generees : valider la version interne ; choisir les supports visuels ; generer la synthese client ; transmettre ou ouvrir l'accompagnement."),
  (New-ParagraphXml -Text "- Preuves attendues : version d'avant-projet approuvee ; message client clair ; supports retenus ; transmission loggee si effectuee."),
  (New-ParagraphXml -Text "- Ecran cible : ecran avant_projet_ready / finalisation."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A valider puis A faire selon la transmission."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Statut : accompaniment_subscribed' -Bold -Size 24),
  (New-ParagraphXml -Text "- Sens metier : le client a choisi l'accompagnement ; l'operateur pilote des actions de coordination plus que de simple production."),
  (New-ParagraphXml -Text "- Taches generees : creer la feuille de route ; suivre les decisions du client ; gerer les attentes ; planifier les points de coordination ; preparer la bascule future si besoin."),
  (New-ParagraphXml -Text "- Preuves attendues : offre activee ; paiement ou accord trace ; feuille de route creee ; prochain jalon programme."),
  (New-ParagraphXml -Text "- Ecran cible : ecran accompaniment_subscribed / coordination active."),
  (New-ParagraphXml -Text "- Type de colonne transverse : A faire, En attente client ou Bloques selon les dependances."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Regles de passage entre colonnes de la vue transverse' -Bold -Size 28),
  (New-ParagraphXml -Text "- Une tache va en A faire si l'operateur peut agir immediatement."),
  (New-ParagraphXml -Text "- Une tache va en A valider si une synthese, une decision, un message ou une publication a ete produite et attend un accord humain."),
  (New-ParagraphXml -Text "- Une tache va en En attente client si la prochaine action depend d'un retour, d'une piece, d'un paiement ou d'un arbitrage client."),
  (New-ParagraphXml -Text "- Une tache va en Bloques si un probleme technique, metier, fournisseur ou de coherence empeche l'avancement."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Role de Marcel dans cette matrice' -Bold -Size 28),
  (New-ParagraphXml -Text "Marcel ne remplace jamais la validation humaine finale. En revanche, il peut produire ou preparer les objets qui alimentent les taches."),
  (New-ParagraphXml -Text "- synthese d'appel,"),
  (New-ParagraphXml -Text "- compte-rendu de visite,"),
  (New-ParagraphXml -Text "- analyse de projet,"),
  (New-ParagraphXml -Text "- recap client,"),
  (New-ParagraphXml -Text "- relance ou message preparatoire,"),
  (New-ParagraphXml -Text "- feuille de route de coordination."),
  (New-ParagraphXml -Text "Chaque fois, le resultat peut creer une tache `awaiting_validation`, mais ne doit pas etre considere comme preuve suffisante tant qu'un operateur n'a pas valide."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Ce qu il faut figer avant de developper' -Bold -Size 28),
  (New-ParagraphXml -Text "- Le catalogue des types de taches et leur ecran cible."),
  (New-ParagraphXml -Text "- Les regles de generation automatique des taches par statut et evenement."),
  (New-ParagraphXml -Text "- Le format des preuves attendues par type de tache."),
  (New-ParagraphXml -Text "- Les delais de relance et de vieillissement de taches."),
  (New-ParagraphXml -Text "- Les colonnes de la vue transverse et leurs conditions de bascule."),
  (New-ParagraphXml -Text "- La structure separee des validations d'onboarding pour le stepper et la preuve de progression."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '10. Recommandation finale' -Bold -Size 28),
  (New-ParagraphXml -Text "Pour preparer un developpement solide, le prochain livrable ideal apres cette matrice serait un dictionnaire de taches. Pour chaque `task.type`, il faudrait decrire : son declencheur, son proprietaire, sa preuve de sortie, son ecran cible, sa priorite et les transitions possibles. Ce dictionnaire deviendra ensuite la specification la plus utile pour coder sans ambiguite.")
)

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($paragraphs -join "`n    ")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$relsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>$([System.Security.SecurityElement]::Escape($title))</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$timestamp</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$timestamp</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>ScantoRenov</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
"@

$buildRoot = Join-Path $env:TEMP ("matrice_statut_taches_docx_" + [guid]::NewGuid().ToString())
$rootRels = Join-Path $buildRoot '_rels'
$docProps = Join-Path $buildRoot 'docProps'
$wordDir = Join-Path $buildRoot 'word'

New-Item -ItemType Directory -Path $rootRels -Force | Out-Null
New-Item -ItemType Directory -Path $docProps -Force | Out-Null
New-Item -ItemType Directory -Path $wordDir -Force | Out-Null

Write-Utf8File -Path (Join-Path $buildRoot '[Content_Types].xml') -Content $contentTypesXml
Write-Utf8File -Path (Join-Path $rootRels '.rels') -Content $relsXml
Write-Utf8File -Path (Join-Path $docProps 'core.xml') -Content $coreXml
Write-Utf8File -Path (Join-Path $docProps 'app.xml') -Content $appXml
Write-Utf8File -Path (Join-Path $wordDir 'document.xml') -Content $documentXml

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

if (Test-Path $OutputPath) {
  Remove-Item $OutputPath -Force
}

$zipPath = Join-Path $env:TEMP ("matrice_statut_taches_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
