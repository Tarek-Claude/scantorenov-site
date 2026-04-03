param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\proposition-poste-pilotage-interne.docx')
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
$title = 'Proposition de poste de pilotage interne'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Objet' -Bold -Size 26),
  (New-ParagraphXml -Text "Ce document consigne une proposition de poste de pilotage interne ScantoRenov, pense comme un espace personnel operateur permettant de suivre, executer, valider et confirmer les actions a realiser tout au long du parcours de chaque client."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Vision generale' -Bold -Size 26),
  (New-ParagraphXml -Text "Le poste de pilotage interne ne doit pas etre un back-office generique. Il doit etre un cockpit de travail personnel, tres simple a utiliser, oriente vers l'action."),
  (New-ParagraphXml -Text "- Un seul champ de recherche doit permettre d'ouvrir tres vite un dossier client."),
  (New-ParagraphXml -Text "- Une fois le client selectionne, l'interface doit afficher son recapitulatif, sa phase metier, son statut pipeline et l'action attendue maintenant."),
  (New-ParagraphXml -Text "- L'operateur doit pouvoir accomplir l'action du moment sans naviguer dans plusieurs ecrans ou remplir des formulaires lourds."),
  (New-ParagraphXml -Text "- Marcel doit devenir l'interface de consignation des syntheses et non un simple chat accessoire."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Principe d usage' -Bold -Size 26),
  (New-ParagraphXml -Text "Le parcours ideal de l'operateur est le suivant : chercher, ouvrir, comprendre ou en est le client, faire l'action attendue, valider, passer au suivant."),
  (New-ParagraphXml -Text "- Saisie des 3 premieres lettres du nom, prenom, email ou telephone."),
  (New-ParagraphXml -Text "- Apparition immediate d'une liste courte de resultats pertinents."),
  (New-ParagraphXml -Text "- Ouverture d'un dossier client unique avec toutes les informations utiles."),
  (New-ParagraphXml -Text "- Presentation d'un seul bouton principal correspondant a l'etape en cours."),
  (New-ParagraphXml -Text "- Validation de l'action et generation automatique de la tache suivante."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Schema ecran par ecran' -Bold -Size 26),
  (New-ParagraphXml -Text 'Ecran 1 : Accueil / recherche' -Bold -Size 24),
  (New-ParagraphXml -Text "- Champ central de recherche client."),
  (New-ParagraphXml -Text "- Suggestions des 5 a 8 meilleurs resultats des la 3e lettre."),
  (New-ParagraphXml -Text "- Affichage rapide du nom, de la phase, du statut et de la prochaine action."),
  (New-ParagraphXml -Text "- Bloc secondaire : mes taches du jour, en attente client, a valider, dossiers recents."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Ecran 2 : Dossier client' -Bold -Size 24),
  (New-ParagraphXml -Text "- Bandeau haut : identite, coordonnees, bien, phase metier, statut pipeline, derniere interaction."),
  (New-ParagraphXml -Text "- Bloc central : action attendue maintenant."),
  (New-ParagraphXml -Text "- Colonne gauche : recap du dossier et timeline."),
  (New-ParagraphXml -Text "- Colonne centrale : outil de travail contextuel."),
  (New-ParagraphXml -Text "- Colonne droite : Marcel operateur."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Ecran 3 : Panneau d action contextuel' -Bold -Size 24),
  (New-ParagraphXml -Text "- Un seul bouton principal par statut."),
  (New-ParagraphXml -Text "- Exemples : preparer l'appel, conduire l'appel, envoyer l'invitation scan, confirmer le scan, synchroniser Matterport, co-produire l'avant-projet, valider et transmettre."),
  (New-ParagraphXml -Text "- Le panneau doit aussi afficher les prerequis manquants, les pieces disponibles et la preuve de validation attendue."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Ecran 4 : Scan et fichiers' -Bold -Size 24),
  (New-ParagraphXml -Text "- Mode manuel : depot des photos, plans, CSV et fichiers locaux depuis le PC."),
  (New-ParagraphXml -Text "- Mode synchronisation : recuperation automatique depuis Matterport a partir du modelId."),
  (New-ParagraphXml -Text "- Apercu de l'iframe, liste des panoramas, pieces, dimensions et plans disponibles."),
  (New-ParagraphXml -Text "- Boutons de rattachement au dossier client et de publication vers l'espace client."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Ecran 5 : Marcel operateur' -Bold -Size 24),
  (New-ParagraphXml -Text "- Modes de dialogue : compte-rendu d'appel, compte-rendu de visite, preparation d'email, production de synthese ou rapport."),
  (New-ParagraphXml -Text "- Sorties visibles : script client, resume validable, lecons globales candidates."),
  (New-ParagraphXml -Text "- Rien n'est ecrit definitivement sans validation humaine explicite."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Ecran 6 : Historique et validations' -Bold -Size 24),
  (New-ParagraphXml -Text "- Timeline de tous les evenements du dossier : rendez-vous, paiements, scans, notes, emails, publications, validations."),
  (New-ParagraphXml -Text "- Chaque evenement doit indiquer ce qui a ete fait, par qui, quand et avec quelle preuve."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Ecran 7 : Vue globale de travail' -Bold -Size 24),
  (New-ParagraphXml -Text "- Quatre colonnes : a faire aujourd'hui, en attente client, a valider, bloques."),
  (New-ParagraphXml -Text "- Filtres : phase, statut, type de tache."),
  (New-ParagraphXml -Text "- Objectif : enchainer les actions sans friction dossier par dossier."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Automatisation Matterport envisagee' -Bold -Size 26),
  (New-ParagraphXml -Text "Avec un compte Pro Matterport, l'automatisation la plus realiste consiste a recuperer cote serveur le modelId, le nom du modele, l'URL d'embed, les locations, les panoramas disponibles, les rooms, les dimensions et les floorplans exposes par le Model API."),
  (New-ParagraphXml -Text "- L'iframe peut etre automatisee a partir du modelId."),
  (New-ParagraphXml -Text "- Les captures d'ecran de vues peuvent etre automatisees via le Showcase SDK."),
  (New-ParagraphXml -Text "- Un CSV metier ScantoRenov peut etre genere par nos soins a partir des donnees JSON recuperees."),
  (New-ParagraphXml -Text "- Les donnees tres avancees de type Property Intelligence ne doivent pas etre supposees disponibles tant que leur niveau d'acces n'est pas confirme."),
  (New-ParagraphXml -Text "- Les cles Matterport doivent etre conservees cote serveur et non saisies durablement dans une interface operateur de production."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Role de Marcel dans le poste de pilotage' -Bold -Size 26),
  (New-ParagraphXml -Text "Marcel doit remplacer une grande partie des formulaires de saisie internes. L'operateur doit pouvoir lui parler librement apres un appel ou une visite, puis valider la synthese structuree proposee."),
  (New-ParagraphXml -Text "- Marcel enrichit la memoire du dossier client apres validation."),
  (New-ParagraphXml -Text "- Marcel peut aussi proposer des apprentissages globaux, mais ceux-ci doivent passer par une file de validation distincte."),
  (New-ParagraphXml -Text "- Cette separation evite de melanger une specificite d'un dossier avec le savoir commun de ScantoRenov."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Socle data minimal recommande' -Bold -Size 26),
  (New-ParagraphXml -Text "- clients : identite, statut, phase, metadonnees projet de base."),
  (New-ParagraphXml -Text "- admin_tasks : taches generees par statut, priorite, etat, due date, preuve, validation."),
  (New-ParagraphXml -Text "- appointments : rendez-vous telephone, scan, accompagnement."),
  (New-ParagraphXml -Text "- project_notes : syntheses d'appel, observations de visite, rapports valides."),
  (New-ParagraphXml -Text "- scans : modelId, iframe, donnees Matterport, plans, assets rattaches."),
  (New-ParagraphXml -Text "- payments : paiements scan, visite, accompagnement."),
  (New-ParagraphXml -Text "- knowledge_candidates : propositions de lecons globales en attente de validation."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Ordre de construction recommande' -Bold -Size 26),
  (New-ParagraphXml -Text "1. Recherche client + ouverture dossier + action attendue."),
  (New-ParagraphXml -Text "2. Generation automatique des taches internes par statut."),
  (New-ParagraphXml -Text "3. Marcel operateur avec validation vers le script client."),
  (New-ParagraphXml -Text "4. Synchronisation Matterport cote serveur et gestion scan & fichiers."),
  (New-ParagraphXml -Text "5. Vue globale de travail et validations transverses."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Conclusion' -Bold -Size 26),
  (New-ParagraphXml -Text "La proposition de poste de pilotage interne repose sur une idee simple : un espace personnel operateur, centre sur la recherche rapide d'un client, la lecture immediate de sa situation, l'execution d'une action contextuelle et la validation propre de chaque etape. L'objectif est de faire gagner du temps, de reduire la dispersion et de transformer Marcel en veritable assistant de production interne.")
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

$buildRoot = Join-Path $env:TEMP ("pilotage_interne_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("pilotage_interne_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
