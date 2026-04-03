param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\wireframe-poste-pilotage-interne-analysis-ready.docx')
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
$title = 'Wireframe detaille - Poste de pilotage interne - Cas analysis_ready'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : decrire l'ecran operateur ideal lorsque le dossier client est au statut `analysis_ready`, c'est-a-dire quand le scan, les observations et le contexte sont suffisamment consolides pour produire l'analyse et preparer l'avant-projet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Intention metier' -Bold -Size 28),
  (New-ParagraphXml -Text "Le statut `analysis_ready` marque le passage de la collecte a l'exploitation. L'operateur ne traite plus seulement des donnees ; il transforme un dossier structure en vision de projet."),
  (New-ParagraphXml -Text "- relire et consolider le contexte client,"),
  (New-ParagraphXml -Text "- structurer les hypotheses de renovation,"),
  (New-ParagraphXml -Text "- orienter Marcel sur les bons scenarios,"),
  (New-ParagraphXml -Text "- faire emerger un programme de travaux coherent,"),
  (New-ParagraphXml -Text "- preparer la production de l'avant-projet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Etat general de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Le dossier s'ouvre avec un bandeau simple et direct :"),
  (New-ParagraphXml -Text "- Client : nom, bien, surface, localisation."),
  (New-ParagraphXml -Text "- Phase metier : Etude / avant-projet."),
  (New-ParagraphXml -Text "- Statut pipeline : analysis_ready."),
  (New-ParagraphXml -Text "- Action attendue maintenant : Produire l'analyse et cadrer l'avant-projet."),
  (New-ParagraphXml -Text "- Bouton principal : Ouvrir l'atelier d'analyse."),
  (New-ParagraphXml -Text "- Boutons secondaires : Ouvrir Marcel, Voir le scan, Enregistrer en brouillon."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Structure de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Je garderais la meme logique a trois colonnes, mais avec un centre transforme en atelier de conception."),
  (New-ParagraphXml -Text "- Colonne gauche : contexte consolide du dossier."),
  (New-ParagraphXml -Text "- Colonne centrale : atelier d'analyse et de cadrage."),
  (New-ParagraphXml -Text "- Colonne droite : Marcel en mode analyse / strategie projet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Colonne gauche : contexte consolide' -Bold -Size 24),
  (New-ParagraphXml -Text "Cette colonne doit donner a l'operateur tout ce qu'il faut pour raisonner juste sans changer de page."),
  (New-ParagraphXml -Text "- Bloc recap client : nom, coordonnees, composition du foyer si connue, disponibilites, niveau d'engagement."),
  (New-ParagraphXml -Text "- Bloc projet initial : demande formulee au depart, besoins identifies a l'appel, budget et echeance confirmes."),
  (New-ParagraphXml -Text "- Bloc scan et bien : resume des dimensions, pieces, niveaux, points techniques, anomalies et observations de visite."),
  (New-ParagraphXml -Text "- Bloc preuves disponibles : photos, plans, CSV, iframe, notes de visite, paiements, rendez-vous."),
  (New-ParagraphXml -Text "- Bloc alertes : informations contradictoires, zones non couvertes, points structurants a clarifier."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Colonne centrale : atelier d analyse' -Bold -Size 24),
  (New-ParagraphXml -Text "Le centre de l'ecran devient un veritable plan de travail en six blocs successifs."),
  (New-ParagraphXml -Text "Bloc A. Diagnostic de depart"),
  (New-ParagraphXml -Text "- ce que l'on sait avec certitude,"),
  (New-ParagraphXml -Text "- ce qui reste a verifier,"),
  (New-ParagraphXml -Text "- ce qui risque d'impacter budget, delais ou faisabilite."),
  (New-ParagraphXml -Text "Bloc B. Intentions du client"),
  (New-ParagraphXml -Text "- objectifs prioritaires,"),
  (New-ParagraphXml -Text "- usages vises,"),
  (New-ParagraphXml -Text "- niveau d'ambition percu,"),
  (New-ParagraphXml -Text "- arbitrages budget / confort / delai."),
  (New-ParagraphXml -Text "Bloc C. Scenarios d'intervention"),
  (New-ParagraphXml -Text "- scenario minimal,"),
  (New-ParagraphXml -Text "- scenario cible,"),
  (New-ParagraphXml -Text "- scenario ambitieux si pertinent."),
  (New-ParagraphXml -Text "Bloc D. Programme de travaux"),
  (New-ParagraphXml -Text "- liste structuree des interventions pressenties,"),
  (New-ParagraphXml -Text "- classement par priorite,"),
  (New-ParagraphXml -Text "- dependances entre interventions."),
  (New-ParagraphXml -Text "Bloc E. Supports visuels et hypotheses Marcel"),
  (New-ParagraphXml -Text "- requetes visuelles a preparer,"),
  (New-ParagraphXml -Text "- points d'inspiration a produire,"),
  (New-ParagraphXml -Text "- zones a faire parler par Marcel."),
  (New-ParagraphXml -Text "Bloc F. Decision de sortie"),
  (New-ParagraphXml -Text "- le dossier est-il pret a devenir un avant-projet formel ?"),
  (New-ParagraphXml -Text "- faut-il encore une iteration d'analyse ?"),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Colonne droite : Marcel en mode analyse' -Bold -Size 24),
  (New-ParagraphXml -Text "Marcel agit ici comme co-analyste, redacteur et contradicteur utile."),
  (New-ParagraphXml -Text "- Mode impose : analyse du projet."),
  (New-ParagraphXml -Text "- Marcel relit le contexte client et le scan avant de proposer des pistes."),
  (New-ParagraphXml -Text "- Il aide a formuler des scenarios, faire ressortir les contraintes, estimer les priorites et preparer les syntheses."),
  (New-ParagraphXml -Text "- Sorties visibles : Synthese d'analyse, Programme de travaux, Questions residuelles, Elements a transmettre au client."),
  (New-ParagraphXml -Text "- Toujours sans ecriture definitive dans le dossier tant que l'operateur n'a pas valide."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Cartes de validation recommandees' -Bold -Size 24),
  (New-ParagraphXml -Text "Pour garder une UX legere, je ferais valider l'analyse par cartes plutot que par formulaire long."),
  (New-ParagraphXml -Text "- Carte Vision projet retenue."),
  (New-ParagraphXml -Text "- Carte Budget compatible ou non avec le scenario cible."),
  (New-ParagraphXml -Text "- Carte Contraintes majeures."),
  (New-ParagraphXml -Text "- Carte Priorites de travaux."),
  (New-ParagraphXml -Text "- Carte Besoins d'images / simulations."),
  (New-ParagraphXml -Text "- Carte Etat de preparation de l'avant-projet."),
  (New-ParagraphXml -Text "Chaque carte propose : Valider, Corriger, Demander a Marcel d'approfondir."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Barre finale de validation' -Bold -Size 24),
  (New-ParagraphXml -Text "En bas de l'ecran, la barre de sortie doit etre tres explicite."),
  (New-ParagraphXml -Text "- Enregistrer en brouillon."),
  (New-ParagraphXml -Text "- Sauver l'analyse interne."),
  (New-ParagraphXml -Text "- Sauver et preparer l'avant-projet."),
  (New-ParagraphXml -Text "- Valider et passer a avant_projet_ready."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Effets systeme attendus apres validation' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand l'operateur valide le travail d'analyse, le systeme doit automatiquement :"),
  (New-ParagraphXml -Text "- enregistrer l'analyse dans le dossier client,"),
  (New-ParagraphXml -Text "- enrichir le script client pour Marcel,"),
  (New-ParagraphXml -Text "- memoriser le programme de travaux retenu,"),
  (New-ParagraphXml -Text "- cloturer la tache d'analyse en cours,"),
  (New-ParagraphXml -Text "- creer la tache suivante : generation ou validation de l'avant-projet,"),
  (New-ParagraphXml -Text "- si la validation est complete, faire evoluer le pipeline vers `avant_projet_ready`."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '10. Trois sorties metier possibles' -Bold -Size 24),
  (New-ParagraphXml -Text "- Cas 1. Analyse solide : le dossier est pret pour l'avant-projet formel."),
  (New-ParagraphXml -Text "- Cas 2. Analyse partielle : le dossier reste en `analysis_ready` avec une nouvelle tache de consolidation."),
  (New-ParagraphXml -Text "- Cas 3. Analyse bloquee : des informations manquent ou sont contradictoires, une action de reprise ou de verification est creee."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '11. Ce qu il faut eviter' -Bold -Size 24),
  (New-ParagraphXml -Text "- Transformer cet ecran en page de lecture passive."),
  (New-ParagraphXml -Text "- Forcer l'operateur a jongler entre scan, notes, photos et Marcel sur plusieurs vues."),
  (New-ParagraphXml -Text "- Produire une analyse client-visible avant validation interne."),
  (New-ParagraphXml -Text "- Confondre ideation avec engagement contractuel."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '12. Principe directeur' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand un dossier est `analysis_ready`, l'operateur doit pouvoir depuis un seul ecran lire le contexte, raisonner avec Marcel, choisir une vision de projet, cadrer les travaux et decider si l'avant-projet est pret a etre produit.")
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

$buildRoot = Join-Path $env:TEMP ("wireframe_analysis_ready_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("wireframe_analysis_ready_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
