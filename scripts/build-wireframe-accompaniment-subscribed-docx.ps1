param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\wireframe-poste-pilotage-interne-accompaniment-subscribed.docx')
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
$title = 'Wireframe detaille - Poste de pilotage interne - Cas accompaniment_subscribed'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : decrire l'ecran operateur ideal lorsque le dossier client est au statut `accompaniment_subscribed`, c'est-a-dire une fois l'offre d'accompagnement choisie et l'accompagnement effectivement enclenche."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Intention metier' -Bold -Size 28),
  (New-ParagraphXml -Text "Le statut `accompaniment_subscribed` ne releve plus de la simple production d'avant-projet. Il ouvre une phase de coordination active et de pilotage concret du parcours accompagne."),
  (New-ParagraphXml -Text "- suivre les engagements pris,"),
  (New-ParagraphXml -Text "- piloter les prochaines actions ScantoRenov,"),
  (New-ParagraphXml -Text "- suivre les actions attendues du client,"),
  (New-ParagraphXml -Text "- transformer les decisions en plan de travail operable,"),
  (New-ParagraphXml -Text "- preparer, si besoin, la bascule future vers une logique MOE."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Etat general de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Le bandeau haut doit etre sans ambiguite :"),
  (New-ParagraphXml -Text "- Phase metier : Projet accompagne."),
  (New-ParagraphXml -Text "- Statut pipeline : accompaniment_subscribed."),
  (New-ParagraphXml -Text "- Offre souscrite : type d'accompagnement, date, montant, niveau d'engagement."),
  (New-ParagraphXml -Text "- Action attendue maintenant : piloter les prochaines etapes de mise en oeuvre du dossier."),
  (New-ParagraphXml -Text "- Bouton principal : Ouvrir le plan d'accompagnement."),
  (New-ParagraphXml -Text "- Boutons secondaires : Ouvrir Marcel, Programmer un rendez-vous, Enregistrer en brouillon."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Structure de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Je ferais de cet ecran un poste de coordination, pas un simple recap."),
  (New-ParagraphXml -Text "- Colonne gauche : dossier de reference et cadre contractuel."),
  (New-ParagraphXml -Text "- Colonne centrale : plan de travail et execution accompagnee."),
  (New-ParagraphXml -Text "- Colonne droite : Marcel en mode coordination et suivi."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Colonne gauche : reference du dossier' -Bold -Size 24),
  (New-ParagraphXml -Text "Cette colonne sert de base stable pour toutes les decisions."),
  (New-ParagraphXml -Text "- Bloc client et projet : identite, bien, budget, echeance, enjeux du projet."),
  (New-ParagraphXml -Text "- Bloc offre souscrite : contenu de l'accompagnement, livrables attendus, limites de perimetre, date de souscription."),
  (New-ParagraphXml -Text "- Bloc dossier technique : scan, analyses, avant-projet, visuels, notes, documents deja valides."),
  (New-ParagraphXml -Text "- Bloc alertes : pieces manquantes, arbitrages non rendus, contraintes fortes, dependances externes."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Colonne centrale : plan d accompagnement' -Bold -Size 24),
  (New-ParagraphXml -Text "Le centre de l'ecran devient un tableau d'actions vivant, structure en six blocs."),
  (New-ParagraphXml -Text "Bloc A. Feuille de route"),
  (New-ParagraphXml -Text "- grandes etapes a venir : cadrage, financement, consultation, selection, planification."),
  (New-ParagraphXml -Text "- jalons prevus et jalons deja franchis."),
  (New-ParagraphXml -Text "Bloc B. Taches actives ScantoRenov"),
  (New-ParagraphXml -Text "- ce que l'equipe doit faire maintenant,"),
  (New-ParagraphXml -Text "- responsable, date cible, niveau d'urgence."),
  (New-ParagraphXml -Text "Bloc C. Attentes client"),
  (New-ParagraphXml -Text "- documents ou confirmations attendus du client,"),
  (New-ParagraphXml -Text "- arbitrages a obtenir,"),
  (New-ParagraphXml -Text "- validations en attente."),
  (New-ParagraphXml -Text "Bloc D. Decisions et arbitrages"),
  (New-ParagraphXml -Text "- choix deja figes,"),
  (New-ParagraphXml -Text "- options encore ouvertes,"),
  (New-ParagraphXml -Text "- impact de chaque decision sur le projet."),
  (New-ParagraphXml -Text "Bloc E. Rendez-vous et points de coordination"),
  (New-ParagraphXml -Text "- appels, reunions, points d'avancement, revues dossier."),
  (New-ParagraphXml -Text "- bouton Programmer un rendez-vous d'accompagnement."),
  (New-ParagraphXml -Text "Bloc F. Decision de suite"),
  (New-ParagraphXml -Text "- poursuivre l'accompagnement,"),
  (New-ParagraphXml -Text "- bloquer le dossier en attente client,"),
  (New-ParagraphXml -Text "- preparer la bascule vers une etape MOE ou execution plus formalisee."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Colonne droite : Marcel en mode coordination' -Bold -Size 24),
  (New-ParagraphXml -Text "Marcel ne joue plus ici un role d'analyse pure ; il devient un assistant de pilotage."),
  (New-ParagraphXml -Text "- Mode impose : coordination / suivi d'accompagnement."),
  (New-ParagraphXml -Text "- Marcel peut resumer une reunion, reformuler une decision, preparer un recap client, proposer une feuille de route, lister les risques ou les dependances."),
  (New-ParagraphXml -Text "- Sorties visibles : Compte-rendu validable, Plan d'action, Risques / blocages, Message client pret a envoyer."),
  (New-ParagraphXml -Text "- Toute ecriture durable reste soumise a validation explicite."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Cartes de validation recommandees' -Bold -Size 24),
  (New-ParagraphXml -Text "Je ferais valider la progression d'accompagnement via des cartes simples et tres actionnables."),
  (New-ParagraphXml -Text "- Carte Offre d'accompagnement bien activee."),
  (New-ParagraphXml -Text "- Carte Feuille de route jour J."),
  (New-ParagraphXml -Text "- Carte Decisions obtenues du client."),
  (New-ParagraphXml -Text "- Carte Pieces / documents manquants."),
  (New-ParagraphXml -Text "- Carte Blocages et risques."),
  (New-ParagraphXml -Text "- Carte Prochain jalon de coordination."),
  (New-ParagraphXml -Text "Chaque carte propose : Valider, Corriger, Reporter, Faire traiter par Marcel."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Barre finale de validation' -Bold -Size 24),
  (New-ParagraphXml -Text "La barre de sortie doit piloter la realite du travail, pas seulement l'etat du dossier."),
  (New-ParagraphXml -Text "- Enregistrer en brouillon."),
  (New-ParagraphXml -Text "- Sauver le plan d'accompagnement."),
  (New-ParagraphXml -Text "- Generer un recap client ou interne."),
  (New-ParagraphXml -Text "- Valider les actions du jour."),
  (New-ParagraphXml -Text "- Ouvrir la prochaine etape de coordination ou de bascule MOE."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Effets systeme attendus apres validation' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand l'operateur valide cet ecran, le systeme doit automatiquement :"),
  (New-ParagraphXml -Text "- mettre a jour le plan d'accompagnement,"),
  (New-ParagraphXml -Text "- enregistrer les comptes-rendus ou decisions valides,"),
  (New-ParagraphXml -Text "- cloturer les taches terminees et creer les suivantes,"),
  (New-ParagraphXml -Text "- mettre a jour les attentes client et les blocages identifies,"),
  (New-ParagraphXml -Text "- preparer, si besoin, le passage vers la prochaine phase structurante."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '10. Trois sorties metier possibles' -Bold -Size 24),
  (New-ParagraphXml -Text "- Cas 1. Accompagnement en cours normal : le plan avance et les prochaines actions sont alimentees."),
  (New-ParagraphXml -Text "- Cas 2. Dossier bloque : le systeme materialise clairement l'attente client, la piece manquante ou l'arbitrage non rendu."),
  (New-ParagraphXml -Text "- Cas 3. Dossier pret a basculer : l'accompagnement a produit suffisamment de matiere pour ouvrir une phase plus engagee de pilotage execution."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '11. Ce qu il faut eviter' -Bold -Size 24),
  (New-ParagraphXml -Text "- Un ecran purement documentaire sans logique de taches."),
  (New-ParagraphXml -Text "- Une confusion entre actions ScantoRenov et actions attendues du client."),
  (New-ParagraphXml -Text "- Laisser Marcel proposer des engagements contractuels sans garde-fou."),
  (New-ParagraphXml -Text "- Perdre la trace des arbitrages qui conditionnent la suite."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '12. Principe directeur' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand un dossier est `accompaniment_subscribed`, l'operateur doit pouvoir depuis un seul ecran piloter la feuille de route, les taches, les attentes client, les decisions et la suite logique du projet, avec Marcel comme assistant de coordination et non comme simple chatbot.")
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

$buildRoot = Join-Path $env:TEMP ("wireframe_accompaniment_subscribed_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("wireframe_accompaniment_subscribed_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
