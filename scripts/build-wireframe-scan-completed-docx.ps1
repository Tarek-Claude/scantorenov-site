param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\wireframe-poste-pilotage-interne-scan-completed.docx')
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
$title = 'Wireframe detaille - Poste de pilotage interne - Cas scan_completed'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : decrire l'ecran operateur ideal lorsque le dossier client est au statut `scan_completed`, c'est-a-dire une fois le scan realise et avant la production finale d'analyse ou d'avant-projet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Intention metier' -Bold -Size 28),
  (New-ParagraphXml -Text "Dans ce cas d'usage, le rendez-vous de scan a eu lieu. L'operateur doit transformer un evenement de terrain en dossier exploitable."),
  (New-ParagraphXml -Text "- recuperer ou verifier les donnees Matterport,"),
  (New-ParagraphXml -Text "- rattacher les photos, plans et fichiers utiles,"),
  (New-ParagraphXml -Text "- consigner les observations de visite,"),
  (New-ParagraphXml -Text "- nourrir Marcel avec un contexte fiable,"),
  (New-ParagraphXml -Text "- decider si le dossier peut passer a l'etape `analysis_ready`."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Etat general de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Le dossier s'ouvre avec un bandeau clair :"),
  (New-ParagraphXml -Text "- Client : Guillaume OLMO"),
  (New-ParagraphXml -Text "- Phase metier : Etude / avant-projet"),
  (New-ParagraphXml -Text "- Statut pipeline : scan_completed"),
  (New-ParagraphXml -Text "- Action attendue maintenant : Structurer le scan, valider les observations, preparer l'analyse."),
  (New-ParagraphXml -Text "- Bouton principal : Traiter le scan."),
  (New-ParagraphXml -Text "- Boutons secondaires : Ouvrir Marcel, Synchroniser Matterport, Enregistrer en brouillon."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Structure de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Je conserverais la meme architecture que l'ecran operateur principal, avec trois colonnes tres lisibles."),
  (New-ParagraphXml -Text "- Colonne gauche : contexte et checklist du dossier."),
  (New-ParagraphXml -Text "- Colonne centrale : traitement du scan et rattachement des pieces."),
  (New-ParagraphXml -Text "- Colonne droite : Marcel operateur en mode compte-rendu de visite."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Colonne gauche : contexte et controle de completude' -Bold -Size 24),
  (New-ParagraphXml -Text "Cette colonne doit servir de tableau de bord instantane."),
  (New-ParagraphXml -Text "- Bloc identite client : nom, telephone, email, adresse du bien."),
  (New-ParagraphXml -Text "- Bloc recap projet : type de bien, surface declaree, budget, echeance, besoins identifies lors de l'appel."),
  (New-ParagraphXml -Text "- Bloc rendez-vous scan : date du scan, duree, adresse, intervenant, statut du paiement."),
  (New-ParagraphXml -Text "- Bloc checklist : modelId renseigne, iframe disponible, donnees scan recuperees, photos presentes, notes de visite validees, Marcel contextualise."),
  (New-ParagraphXml -Text "- Bloc alertes : ecart de surface, fichiers manquants, donnees incoherentes, publication impossible."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Colonne centrale : traitement du scan' -Bold -Size 24),
  (New-ParagraphXml -Text "C'est ici que tout se joue. Je decomposerais la colonne en cinq sous-blocs verticaux."),
  (New-ParagraphXml -Text "Bloc A. Source Matterport"),
  (New-ParagraphXml -Text "- champ modelId ou valeur deja detectee,"),
  (New-ParagraphXml -Text "- bouton Synchroniser depuis Matterport,"),
  (New-ParagraphXml -Text "- retour de sync : nombre de panoramas, rooms, dimensions, floorplans, etat de la connexion."),
  (New-ParagraphXml -Text "Bloc B. Assets et fichiers locaux"),
  (New-ParagraphXml -Text "- depots PC : photos, plans, CSV, notes brutes, documents complementaires,"),
  (New-ParagraphXml -Text "- zone de rattachement par glisser-deposer,"),
  (New-ParagraphXml -Text "- indication claire de ce qui vient du PC et de ce qui vient de Matterport."),
  (New-ParagraphXml -Text "Bloc C. Apercu du scan"),
  (New-ParagraphXml -Text "- iframe Matterport ou viewer embarque,"),
  (New-ParagraphXml -Text "- resume des pieces detectees, niveaux, surfaces et plans disponibles,"),
  (New-ParagraphXml -Text "- bouton Generer CSV ScantoRenov a partir des donnees recuperees."),
  (New-ParagraphXml -Text "Bloc D. Observations de visite"),
  (New-ParagraphXml -Text "- observations generales du bien,"),
  (New-ParagraphXml -Text "- points techniques d'attention,"),
  (New-ParagraphXml -Text "- contraintes identifiees sur place,"),
  (New-ParagraphXml -Text "- photos remarquables a marquer comme importantes."),
  (New-ParagraphXml -Text "Bloc E. Decision de passage"),
  (New-ParagraphXml -Text "- le dossier est-il complet pour activer Marcel et la phase d'analyse ?"),
  (New-ParagraphXml -Text "- bouton Passer a analysis_ready si toutes les conditions sont reunies."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Colonne droite : Marcel operateur en mode visite' -Bold -Size 24),
  (New-ParagraphXml -Text "Dans ce cas, Marcel ne doit pas etre un simple assistant conversationnel. Il devient le redacteur et le structurant du dossier."),
  (New-ParagraphXml -Text "- Mode impose : compte-rendu de visite."),
  (New-ParagraphXml -Text "- L'operateur peut lui dicter ou lui coller ses notes de terrain."),
  (New-ParagraphXml -Text "- Marcel propose ensuite une synthese structuree : etat general, points forts, points faibles, hypotheses, besoins de verification, recommandations de suite."),
  (New-ParagraphXml -Text "- Trois sorties restent visibles : Resume validable, Script client, Lecons globales candidates."),
  (New-ParagraphXml -Text "- Le script client est enrichi seulement apres validation de l'operateur."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Cartes de validation recommandees' -Bold -Size 24),
  (New-ParagraphXml -Text "Pour eviter un grand formulaire rigide, je ferais apparaitre des cartes validables une a une."),
  (New-ParagraphXml -Text "- Carte Surface mesuree vs surface declaree."),
  (New-ParagraphXml -Text "- Carte Nombre de pieces / niveaux identifies."),
  (New-ParagraphXml -Text "- Carte Qualite des plans et de la couverture scan."),
  (New-ParagraphXml -Text "- Carte Observations techniques majeures."),
  (New-ParagraphXml -Text "- Carte Photos prioritaires retenues."),
  (New-ParagraphXml -Text "- Carte Etat du dossier pour Marcel."),
  (New-ParagraphXml -Text "- Carte Decision : pret pour analyse ou a completer."),
  (New-ParagraphXml -Text "Chaque carte offre trois actions : Valider, Corriger, Reporter."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Barre finale de validation' -Bold -Size 24),
  (New-ParagraphXml -Text "En bas de l'ecran, je prevois une barre tres lisible avec quatre chemins de sortie."),
  (New-ParagraphXml -Text "- Enregistrer en brouillon."),
  (New-ParagraphXml -Text "- Sauver les observations de visite."),
  (New-ParagraphXml -Text "- Sauver et contextualiser Marcel."),
  (New-ParagraphXml -Text "- Valider le scan et passer a analysis_ready."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Effets systeme attendus apres validation' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand l'operateur valide le traitement du scan, le systeme doit automatiquement :"),
  (New-ParagraphXml -Text "- enregistrer les observations de visite dans le dossier client,"),
  (New-ParagraphXml -Text "- rattacher les fichiers et donnees scan au bon client,"),
  (New-ParagraphXml -Text "- stocker ou mettre a jour l'iframe et les donnees Matterport,"),
  (New-ParagraphXml -Text "- generer le CSV metier si necessaire,"),
  (New-ParagraphXml -Text "- enrichir le contexte de Marcel,"),
  (New-ParagraphXml -Text "- cloturer la tache en cours,"),
  (New-ParagraphXml -Text "- creer la tache suivante : produire l'analyse ou l'avant-projet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '10. Trois sorties metier possibles' -Bold -Size 24),
  (New-ParagraphXml -Text "- Cas 1. Dossier complet : le scan est traite, le contexte est solide, le statut peut passer a analysis_ready."),
  (New-ParagraphXml -Text "- Cas 2. Dossier partiel : le scan est present mais il manque encore des photos, un CSV, un iframe ou des observations. Le dossier reste en brouillon operateur."),
  (New-ParagraphXml -Text "- Cas 3. Dossier incoherent : les donnees remontent mal, le modelId est faux ou les assets sont insuffisants. Une tache de correction ou de reprise est creee."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '11. Ce qu il faut eviter' -Bold -Size 24),
  (New-ParagraphXml -Text "- Multiplier les ecrans pour une meme action."),
  (New-ParagraphXml -Text "- Demander a l'operateur de faire des copier-coller repetitifs entre Matterport, fichiers locaux et notes internes."),
  (New-ParagraphXml -Text "- Ecrire automatiquement dans la memoire globale de Marcel sans validation."),
  (New-ParagraphXml -Text "- Confondre publication client et traitement interne du scan."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '12. Principe directeur' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand un dossier est `scan_completed`, l'operateur doit pouvoir, depuis un seul ecran, recuperer la matiere du scan, verifier sa qualite, produire une synthese de visite avec Marcel, puis decider proprement si le dossier est pret a entrer en phase d'analyse.")
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

$buildRoot = Join-Path $env:TEMP ("wireframe_scan_completed_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("wireframe_scan_completed_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
