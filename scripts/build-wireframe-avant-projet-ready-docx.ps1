param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\wireframe-poste-pilotage-interne-avant-projet-ready.docx')
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
$title = 'Wireframe detaille - Poste de pilotage interne - Cas avant_projet_ready'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : decrire l'ecran operateur ideal lorsque le dossier client est au statut `avant_projet_ready`, c'est-a-dire quand l'analyse est suffisamment mature pour devenir un livrable interne puis un support de transmission et d'accompagnement."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Intention metier' -Bold -Size 28),
  (New-ParagraphXml -Text "Le statut `avant_projet_ready` correspond au moment ou l'intelligence produite dans le dossier doit etre transformee en proposition lisible, assumee et transmissible."),
  (New-ParagraphXml -Text "- verifier que l'avant-projet est coherent,"),
  (New-ParagraphXml -Text "- consolider les messages a transmettre au client,"),
  (New-ParagraphXml -Text "- preparer les supports de synthese ou de proposition,"),
  (New-ParagraphXml -Text "- decider si le dossier est pret a etre transmis, presente ou converti en accompagnement."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Etat general de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Le dossier s'ouvre avec un bandeau de pilotage tres clair :"),
  (New-ParagraphXml -Text "- Client : nom, bien, localisation, niveau de maturite du projet."),
  (New-ParagraphXml -Text "- Phase metier : Avant-projet."),
  (New-ParagraphXml -Text "- Statut pipeline : avant_projet_ready."),
  (New-ParagraphXml -Text "- Action attendue maintenant : Finaliser, valider et transmettre l'avant-projet."),
  (New-ParagraphXml -Text "- Bouton principal : Ouvrir l'atelier d'avant-projet."),
  (New-ParagraphXml -Text "- Boutons secondaires : Ouvrir Marcel, Voir le rapport, Enregistrer en brouillon."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Structure de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Je garderais la meme architecture generale que pour les autres statuts, mais avec un centre tourne vers la validation finale et la transmission."),
  (New-ParagraphXml -Text "- Colonne gauche : recap de reference du dossier."),
  (New-ParagraphXml -Text "- Colonne centrale : atelier de finalisation de l'avant-projet."),
  (New-ParagraphXml -Text "- Colonne droite : Marcel en mode synthese et projection."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Colonne gauche : recap de reference' -Bold -Size 24),
  (New-ParagraphXml -Text "Cette colonne sert d'ancrage et de garde-fou avant toute transmission."),
  (New-ParagraphXml -Text "- Bloc client et projet : identite, bien, type de projet, budget, echeance, besoins prioritaires."),
  (New-ParagraphXml -Text "- Bloc preuves du dossier : scan, observations, plans, photos, CSV, analyses, visuels generes, echanges avec Marcel."),
  (New-ParagraphXml -Text "- Bloc synthese parcours : appel, visite, analyse, choix retenus, hypotheses encore ouvertes."),
  (New-ParagraphXml -Text "- Bloc alertes : points non arbitres, incertitudes budgetaires, contraintes techniques, points a clarifier avec le client."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Colonne centrale : atelier de finalisation de l avant-projet' -Bold -Size 24),
  (New-ParagraphXml -Text "Le centre de l'ecran doit devenir un poste de mise en forme et de validation, en sept blocs logiques."),
  (New-ParagraphXml -Text "Bloc A. Vision d'ensemble"),
  (New-ParagraphXml -Text "- formulation courte du projet retenu,"),
  (New-ParagraphXml -Text "- niveau d'ambition,"),
  (New-ParagraphXml -Text "- promesse generale de transformation du bien."),
  (New-ParagraphXml -Text "Bloc B. Programme de travaux finalise"),
  (New-ParagraphXml -Text "- interventions retenues,"),
  (New-ParagraphXml -Text "- priorisation,"),
  (New-ParagraphXml -Text "- elements optionnels ou variantes."),
  (New-ParagraphXml -Text "Bloc C. Hypotheses et limites"),
  (New-ParagraphXml -Text "- ce qui est confirme,"),
  (New-ParagraphXml -Text "- ce qui reste indicatif,"),
  (New-ParagraphXml -Text "- ce qui dependra d'etudes complementaires ou d'entreprises."),
  (New-ParagraphXml -Text "Bloc D. Supports visuels et medias"),
  (New-ParagraphXml -Text "- visuels retenus pour illustrer l'avant-projet,"),
  (New-ParagraphXml -Text "- captures ou supports Matterport associes,"),
  (New-ParagraphXml -Text "- selection de ce qui est montrable au client."),
  (New-ParagraphXml -Text "Bloc E. Message client"),
  (New-ParagraphXml -Text "- formulation de la synthese client,"),
  (New-ParagraphXml -Text "- prochaines etapes proposees,"),
  (New-ParagraphXml -Text "- invitation eventuelle vers l'offre d'accompagnement."),
  (New-ParagraphXml -Text "Bloc F. Statut de livraison"),
  (New-ParagraphXml -Text "- pret en interne,"),
  (New-ParagraphXml -Text "- pret a transmettre,"),
  (New-ParagraphXml -Text "- pret a discuter en rendez-vous."),
  (New-ParagraphXml -Text "Bloc G. Decision de passage"),
  (New-ParagraphXml -Text "- transmettre l'avant-projet,"),
  (New-ParagraphXml -Text "- demander une derniere iteration,"),
  (New-ParagraphXml -Text "- ouvrir la suite accompagnement / proposition commerciale."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Colonne droite : Marcel en mode synthese finale' -Bold -Size 24),
  (New-ParagraphXml -Text "Dans ce cas, Marcel doit aider a clarifier, reformuler et preparer les supports de communication."),
  (New-ParagraphXml -Text "- Mode impose : synthese finale / projection."),
  (New-ParagraphXml -Text "- Marcel propose une formulation elegante et pedagogique de l'avant-projet."),
  (New-ParagraphXml -Text "- Il aide a distinguer le discours interne du discours client-visible."),
  (New-ParagraphXml -Text "- Il peut produire trois sorties utiles : note interne, version client, base de proposition d'accompagnement."),
  (New-ParagraphXml -Text "- Rien n'est publie sans validation explicite de l'operateur."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Cartes de validation recommandees' -Bold -Size 24),
  (New-ParagraphXml -Text "Pour rester tres actionnable, je ferais valider l'avant-projet via des cartes simples."),
  (New-ParagraphXml -Text "- Carte Coherence generale du projet."),
  (New-ParagraphXml -Text "- Carte Compatibilite budget / ambition."),
  (New-ParagraphXml -Text "- Carte Variantes ou options a garder visibles."),
  (New-ParagraphXml -Text "- Carte Supports visuels selectionnes."),
  (New-ParagraphXml -Text "- Carte Message client final."),
  (New-ParagraphXml -Text "- Carte Ouverture vers accompagnement ou non."),
  (New-ParagraphXml -Text "Chaque carte propose : Valider, Corriger, Faire retravailler par Marcel."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Barre finale de validation' -Bold -Size 24),
  (New-ParagraphXml -Text "En bas de l'ecran, la barre de sortie doit rendre la decision tres claire."),
  (New-ParagraphXml -Text "- Enregistrer en brouillon."),
  (New-ParagraphXml -Text "- Sauver la version interne de l'avant-projet."),
  (New-ParagraphXml -Text "- Generer la synthese client."),
  (New-ParagraphXml -Text "- Valider et transmettre l'avant-projet."),
  (New-ParagraphXml -Text "- Valider et ouvrir l'etape d'accompagnement."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Effets systeme attendus apres validation' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand l'operateur valide cet ecran, le systeme doit automatiquement :"),
  (New-ParagraphXml -Text "- enregistrer la version finalisee de l'avant-projet,"),
  (New-ParagraphXml -Text "- memoriser les visuels et supports retenus,"),
  (New-ParagraphXml -Text "- generer ou mettre a jour le resume client si necessaire,"),
  (New-ParagraphXml -Text "- cloturer la tache de finalisation en cours,"),
  (New-ParagraphXml -Text "- creer la tache suivante : transmission, presentation, ou accompagnement,"),
  (New-ParagraphXml -Text "- faire evoluer le dossier vers la suite logique definie par l'operateur."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '10. Trois sorties metier possibles' -Bold -Size 24),
  (New-ParagraphXml -Text "- Cas 1. Avant-projet transmis : le dossier est pret pour presentation ou envoi au client."),
  (New-ParagraphXml -Text "- Cas 2. Avant-projet a reprendre : une ultime iteration est necessaire, sans transmettre trop tot."),
  (New-ParagraphXml -Text "- Cas 3. Avant-projet converti en accompagnement : le dossier sert directement de tremplin vers l'offre suivante."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '11. Ce qu il faut eviter' -Bold -Size 24),
  (New-ParagraphXml -Text "- Confondre version interne de travail et version client."),
  (New-ParagraphXml -Text "- Laisser partir un avant-projet sans clarifier ce qui est confirme et ce qui reste hypothese."),
  (New-ParagraphXml -Text "- Trop charger l'ecran avec des micro-details techniques deja traites plus tot."),
  (New-ParagraphXml -Text "- Donner a Marcel un role de validation finale a la place de l'operateur."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '12. Principe directeur' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand un dossier est `avant_projet_ready`, l'operateur doit pouvoir depuis un seul ecran verifier la maturite du livrable, clarifier le message a transmettre, valider les supports et decider sereinement si l'avant-projet part vers le client ou vers l'etape d'accompagnement.")
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

$buildRoot = Join-Path $env:TEMP ("wireframe_avant_projet_ready_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("wireframe_avant_projet_ready_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
