param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\dictionnaire-task-types-preparation-dev.docx')
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

function Add-TaskType {
  param(
    [string]$Key,
    [string]$Purpose,
    [string]$Trigger,
    [string]$Owner,
    [string]$Proof,
    [string]$Screen,
    [string]$Priority,
    [string]$Transitions
  )

  return @(
    (New-ParagraphXml -Text $Key -Bold -Size 24),
    (New-ParagraphXml -Text "But : $Purpose"),
    (New-ParagraphXml -Text "Declencheur : $Trigger"),
    (New-ParagraphXml -Text "Proprietaire par defaut : $Owner"),
    (New-ParagraphXml -Text "Preuve de sortie attendue : $Proof"),
    (New-ParagraphXml -Text "Ecran cible : $Screen"),
    (New-ParagraphXml -Text "Priorite par defaut : $Priority"),
    (New-ParagraphXml -Text "Transitions possibles : $Transitions"),
    (New-BlankParagraphXml)
  )
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$title = 'Dictionnaire des task.type - Preparation au developpement'

$paragraphs = New-Object System.Collections.Generic.List[string]

$intro = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : definir un dictionnaire initial des types de taches operateur qui servira de specification de reference avant le developpement du poste de pilotage interne."),
  (New-ParagraphXml -Text "Ce document prolonge la matrice `statut -> taches -> preuves -> ecran cible` et doit permettre de coder plus tard sans ambiguite sur le role de chaque tache."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Regles de conception' -Bold -Size 28),
  (New-ParagraphXml -Text "- Un task.type doit decrire une action operateur ou une attente pilotable, pas un simple etat systeme."),
  (New-ParagraphXml -Text "- Un task.type doit pouvoir exister independamment du statut dossier, meme s'il est souvent genere par lui."),
  (New-ParagraphXml -Text "- La preuve de sortie doit etre objective et observable."),
  (New-ParagraphXml -Text "- L'ecran cible doit pointer vers l'ecran de travail le plus pertinent, pas juste vers le dossier client generique."),
  (New-ParagraphXml -Text "- Les transitions de tache concernent l'etat de la tache : open, awaiting_validation, waiting_client, blocked, done, cancelled."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Champs minimaux recommandes pour chaque tache' -Bold -Size 28),
  (New-ParagraphXml -Text "task.type, title, client_id, owner, status, priority, due_at, expected_proof, screen_target, blocking_reason, created_from, created_at, updated_at, completed_at."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Dictionnaire initial des task.type' -Bold -Size 28)
)

foreach ($p in $intro) { [void]$paragraphs.Add($p) }

$taskGroups = @()

$taskGroups += Add-TaskType -Key 'lead_review' `
  -Purpose "Verifier qu'un nouveau lead est exploitable et qu'aucune anomalie de qualification initiale ne bloque la suite." `
  -Trigger "Creation d'un client en statut new_lead ou detection d'un lead incomplet / incoherent." `
  -Owner "chef_projet ou admin qualification" `
  -Proof "Dossier minimal valide ou motif de rejet / relance enregistre." `
  -Screen "cockpit qualification initiale" `
  -Priority "normale ; haute si lead incomplet ou douteux" `
  -Transitions "open -> done ; open -> waiting_client ; open -> blocked ; open -> cancelled"

$taskGroups += Add-TaskType -Key 'onboarding_nudge' `
  -Purpose "Relancer un prospect qui a cree son compte mais n'a pas termine le parcours de decouverte." `
  -Trigger "Stagnation sur account_created ou onboarding incomplet apres delai cible." `
  -Owner "systeme puis chef_projet si relance manuelle requise" `
  -Proof "Relance envoyee ou onboarding complete par le client." `
  -Screen "suivi onboarding / vue transverse" `
  -Priority "normale ; haute si prospect a forte valeur et bloquage long" `
  -Transitions "open -> done ; open -> waiting_client ; open -> cancelled"

$taskGroups += Add-TaskType -Key 'onboarding_validate_proof' `
  -Purpose "Verifier que le prospect a reellement complete les etapes de decouverte avec preuve de progression." `
  -Trigger "Completion du stepper de qualification ou signalement d'une incoherence de validation." `
  -Owner "systeme avec validation humaine exceptionnelle" `
  -Proof "Quatre validations d'etapes stockees avec preuve associee." `
  -Screen "ecran onboarding / stepper" `
  -Priority "normale" `
  -Transitions "open -> done ; open -> blocked"

$taskGroups += Add-TaskType -Key 'phone_call_prepare' `
  -Purpose "Preparer l'appel avec le bon contexte client avant le rendez-vous telephone." `
  -Trigger "Creation ou proximite d'un appointment type phone_call." `
  -Owner "chef_projet" `
  -Proof "Contexte de l'appel relu ; rendez-vous confirme ; note preparatoire eventuelle disponible." `
  -Screen "ecran apres appel telephonique (mode preparation)" `
  -Priority "haute a l'approche du rendez-vous" `
  -Transitions "open -> done ; open -> blocked ; open -> cancelled"

$taskGroups += Add-TaskType -Key 'phone_call_complete' `
  -Purpose "Tenir l'appel et faire exister la matiere de qualification du dossier." `
  -Trigger "Appointment telephone demarre ou termine." `
  -Owner "chef_projet" `
  -Proof "Compte-rendu brut ou notes suffisantes captures apres l'appel." `
  -Screen "ecran apres appel telephonique" `
  -Priority "haute" `
  -Transitions "open -> awaiting_validation ; open -> waiting_client ; open -> blocked"

$taskGroups += Add-TaskType -Key 'phone_summary_validate' `
  -Purpose "Valider la synthese d'appel, les besoins, le budget, l'echeance et la prochaine etape." `
  -Trigger "Synthese d'appel proposee par Marcel ou saisie manuellement apres phone_call_complete." `
  -Owner "chef_projet" `
  -Proof "Synthese validee et stockee ; prochaine etape decidee ; statut client coherent." `
  -Screen "ecran apres appel telephonique" `
  -Priority "haute car bloquante pour la suite" `
  -Transitions "awaiting_validation -> done ; awaiting_validation -> open ; awaiting_validation -> blocked"

$taskGroups += Add-TaskType -Key 'scan_invitation_send' `
  -Purpose "Envoyer l'invitation a prendre rendez-vous pour le scan 3D." `
  -Trigger "call_done valide et dossier juge eligible a la phase scan." `
  -Owner "chef_projet ou systeme assiste" `
  -Proof "Email d'invitation envoye et journalise." `
  -Screen "ecran post-appel / decision" `
  -Priority "haute juste apres qualification positive" `
  -Transitions "open -> done ; open -> blocked"

$taskGroups += Add-TaskType -Key 'scan_booking_followup' `
  -Purpose "Suivre la prise effective du rendez-vous scan par le prospect." `
  -Trigger "Invitation scan envoyee sans reservation dans le delai cible." `
  -Owner "chef_projet ou systeme avec relance" `
  -Proof "Appointment scan cree ou relance envoyee." `
  -Screen "suivi scan & paiement / vue transverse" `
  -Priority "normale ; haute si delai depasse" `
  -Transitions "open -> done ; open -> waiting_client ; open -> cancelled"

$taskGroups += Add-TaskType -Key 'scan_payment_followup' `
  -Purpose "Obtenir ou verifier le paiement necessaire a la confirmation du scan." `
  -Trigger "scan_scheduled sans scan_payment_completed dans le delai attendu." `
  -Owner "chef_projet ou systeme avec relance" `
  -Proof "Paiement enregistre ou situation clarifiee avec le client." `
  -Screen "suivi scan & paiement" `
  -Priority "haute car bloque la visite confirmee" `
  -Transitions "open -> done ; open -> waiting_client ; open -> blocked ; open -> cancelled"

$taskGroups += Add-TaskType -Key 'scan_visit_prepare' `
  -Purpose "Preparer la visite de scan une fois le paiement recu et le rendez-vous confirme." `
  -Trigger "scan_payment_completed." `
  -Owner "chef_projet" `
  -Proof "Infos de visite verifiees ; logistique confirmee ; materiel / acces prets." `
  -Screen "pre-scan operations" `
  -Priority "haute avant la visite" `
  -Transitions "open -> done ; open -> blocked"

$taskGroups += Add-TaskType -Key 'scan_assets_sync' `
  -Purpose "Transformer le scan realise en matiere exploitable : Matterport, iframe, photos, plans, CSV." `
  -Trigger "scan_completed." `
  -Owner "chef_projet ou operateur technique" `
  -Proof "Donnees scan rattachees au dossier ; modelId/iframe stockes ; fichiers relies au client." `
  -Screen "ecran scan_completed / traitement du scan" `
  -Priority "haute" `
  -Transitions "open -> awaiting_validation ; open -> blocked ; open -> waiting_client"

$taskGroups += Add-TaskType -Key 'visit_summary_validate' `
  -Purpose "Valider les observations de visite et enrichir le contexte dossier et Marcel." `
  -Trigger "Compte-rendu de visite propose apres scan_assets_sync." `
  -Owner "chef_projet" `
  -Proof "Observations de visite validees ; points techniques et contraintes stockes." `
  -Screen "ecran scan_completed / traitement du scan" `
  -Priority "haute car conditionne analysis_ready" `
  -Transitions "awaiting_validation -> done ; awaiting_validation -> open ; awaiting_validation -> blocked"

$taskGroups += Add-TaskType -Key 'analysis_build' `
  -Purpose "Produire l'analyse du projet, les scenarios et le programme de travaux." `
  -Trigger "Dossier suffisamment complet apres scan_completed et validation des observations." `
  -Owner "chef_projet avec Marcel en co-pilote" `
  -Proof "Analyse structurée produite avec scenarios, hypotheses et priorites." `
  -Screen "ecran analysis_ready / atelier d'analyse" `
  -Priority "haute" `
  -Transitions "open -> awaiting_validation ; open -> blocked"

$taskGroups += Add-TaskType -Key 'analysis_validate' `
  -Purpose "Valider l'analyse et decider si le dossier peut devenir un avant-projet formel." `
  -Trigger "Analyse produite ou retravaillee." `
  -Owner "chef_projet" `
  -Proof "Analyse approuvee ; scenario retenu ; sortie vers avant_projet_ready decidee." `
  -Screen "ecran analysis_ready / atelier d'analyse" `
  -Priority "haute et bloquante" `
  -Transitions "awaiting_validation -> done ; awaiting_validation -> open ; awaiting_validation -> blocked"

$taskGroups += Add-TaskType -Key 'avant_project_finalize' `
  -Purpose "Finaliser la version interne de l'avant-projet, les supports visuels et le message de synthese." `
  -Trigger "avant_projet_ready." `
  -Owner "chef_projet" `
  -Proof "Version interne complete ; supports retenus ; message client clarifie." `
  -Screen "ecran avant_projet_ready / finalisation" `
  -Priority "haute" `
  -Transitions "open -> awaiting_validation ; open -> blocked"

$taskGroups += Add-TaskType -Key 'avant_project_transmit' `
  -Purpose "Transmettre ou presenter l'avant-projet au client et journaliser l'action." `
  -Trigger "Avant-projet finalise et valide en interne." `
  -Owner "chef_projet" `
  -Proof "Transmission enregistree ; version client generee ; prochaine suite decidee." `
  -Screen "ecran avant_projet_ready / finalisation" `
  -Priority "haute" `
  -Transitions "open -> done ; open -> waiting_client ; open -> blocked"

$taskGroups += Add-TaskType -Key 'offer_discussion_prepare' `
  -Purpose "Preparer un echange sur l'offre d'accompagnement et ses implications." `
  -Trigger "Avant-projet transmis et necessite d'ouvrir la discussion d'accompagnement." `
  -Owner "chef_projet" `
  -Proof "Proposition d'offre preparee ; rendez-vous ou support d'echange pret." `
  -Screen "ecran avant_projet_ready / finalisation" `
  -Priority "normale a haute selon maturite client" `
  -Transitions "open -> done ; open -> waiting_client ; open -> cancelled"

$taskGroups += Add-TaskType -Key 'accompaniment_kickoff' `
  -Purpose "Activer concretement l'accompagnement apres souscription et creer la feuille de route initiale." `
  -Trigger "accompaniment_subscribed." `
  -Owner "chef_projet ou responsable coordination" `
  -Proof "Feuille de route creee ; jalon initial programme ; offre activee dans le dossier." `
  -Screen "ecran accompaniment_subscribed / coordination active" `
  -Priority "haute juste apres souscription" `
  -Transitions "open -> done ; open -> blocked"

$taskGroups += Add-TaskType -Key 'accompaniment_coordinate' `
  -Purpose "Piloter au fil de l'eau les actions, attentes client, arbitrages et rendez-vous de l'accompagnement." `
  -Trigger "Feuille de route active sur un dossier accompagne." `
  -Owner "responsable coordination / chef_projet" `
  -Proof "Actions du jour traitees ; decisions journalisees ; prochain jalon renseigne." `
  -Screen "ecran accompaniment_subscribed / coordination active" `
  -Priority "variable selon jalon, mais souvent haute" `
  -Transitions "open -> done ; open -> waiting_client ; open -> blocked ; open -> awaiting_validation"

$taskGroups += Add-TaskType -Key 'client_followup_waiting' `
  -Purpose "Materieliser une attente client traquee et relancable, quel que soit le statut dossier." `
  -Trigger "Absence de retour client sur une piece, un paiement, un arbitrage ou une validation." `
  -Owner "systeme avec reprise possible par chef_projet" `
  -Proof "Retour client recu, relance faite, ou attente explicitement replanifiee." `
  -Screen "vue transverse / puis dossier cible pertinent" `
  -Priority "normale ; devient haute avec vieillissement" `
  -Transitions "waiting_client -> open ; waiting_client -> done ; waiting_client -> blocked ; waiting_client -> cancelled"

$taskGroups += Add-TaskType -Key 'blocker_resolve' `
  -Purpose "Traiter un blocage interne, technique, metier, fournisseur ou donnees." `
  -Trigger "Toute tache basculant en blocked avec motif de blocage explicite." `
  -Owner "variable selon nature du blocage" `
  -Proof "Cause du blocage resolue ou decision explicite de suspension / abandon." `
  -Screen "vue transverse / colonne Bloques puis dossier cible" `
  -Priority "haute" `
  -Transitions "blocked -> open ; blocked -> done ; blocked -> cancelled"

$taskGroups += Add-TaskType -Key 'marcel_output_validate' `
  -Purpose "Valider une production de Marcel avant qu'elle n'alimente durablement le dossier ou le client." `
  -Trigger "Toute sortie Marcel importante : synthese, analyse, recap, message client, feuille de route." `
  -Owner "chef_projet" `
  -Proof "Sortie approuvee, corrigee ou rejetee ; destination de publication decidee." `
  -Screen "ecran metier source ou panneau Marcel operateur" `
  -Priority "haute quand bloquante pour la suite" `
  -Transitions "awaiting_validation -> done ; awaiting_validation -> open ; awaiting_validation -> blocked ; awaiting_validation -> cancelled"

foreach ($p in $taskGroups) { [void]$paragraphs.Add($p) }

$outro = @(
  (New-ParagraphXml -Text '4. Recommandation pour l etape suivante' -Bold -Size 28),
  (New-ParagraphXml -Text "Le prochain document utile avant de developper serait un mapping technique `event -> task.type` pour preciser exactement a quel moment chaque tache est creee, fusionnee, fermee ou reouverte."),
  (New-ParagraphXml -Text "Exemple : `confirm-scan success` -> cree `scan_assets_sync` ; `visit_summary validated` -> ferme `visit_summary_validate` et cree `analysis_build`."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Principe directeur final' -Bold -Size 28),
  (New-ParagraphXml -Text "Le dictionnaire des task.type doit devenir la reference commune entre produit, UX et developpement. Si chaque type de tache est net, le poste de pilotage interne pourra etre code plus tard avec un minimum d'interpretation et un maximum de coherence.")
)

foreach ($p in $outro) { [void]$paragraphs.Add($p) }

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

$buildRoot = Join-Path $env:TEMP ("dictionnaire_task_types_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("dictionnaire_task_types_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
