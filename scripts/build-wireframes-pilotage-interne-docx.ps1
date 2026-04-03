param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\wireframes-poste-pilotage-interne.docx')
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
$title = 'Wireframes du poste de pilotage interne'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : consigner la proposition d'ecran principal operateur et le wireframe detaille du cas d'usage apres appel telephonique."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Partie A. Ecran principal operateur' -Bold -Size 28),
  (New-ParagraphXml -Text "Le poste de pilotage doit etre concu comme un cockpit personnel operateur, centre sur trois verbes : chercher, agir, valider."),
  (New-ParagraphXml -Text "- Barre haute : un champ unique de recherche client, auto-completion des la 3e lettre, et acces aux compteurs A faire, En attente, A valider."),
  (New-ParagraphXml -Text "- Bandeau dossier : nom du client, coordonnees, bien, phase metier, statut pipeline, dernier contact, niveau d'urgence."),
  (New-ParagraphXml -Text "- Bloc Action attendue maintenant : une seule action principale, deux actions secondaires maximum, prerequis affiches et preuve de validation attendue."),
  (New-ParagraphXml -Text "- Colonne gauche Dossier : identite, projet initial, timeline, taches du dossier, pieces disponibles."),
  (New-ParagraphXml -Text "- Colonne centrale Espace d'action : contenu contextuel selon le statut, par exemple appel, invitation scan, confirmation, synchronisation Matterport, production d'avant-projet."),
  (New-ParagraphXml -Text "- Colonne droite Marcel operateur : conversation, resume validable, script client, lecons globales candidates."),
  (New-ParagraphXml -Text "- Bandeau bas ou bloc secondaire : historique rapide, pieces jointes, emails envoyes, paiements, rendez-vous."),
  (New-ParagraphXml -Text "L'ecran doit toujours repondre en moins de 5 secondes a quatre questions : qui est ce client, ou en est-il, que dois-je faire maintenant, que me manque-t-il pour cloturer cette etape."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text 'Partie B. Wireframe detaille du cas apres appel telephonique' -Bold -Size 28),
  (New-ParagraphXml -Text "Contexte : l'appel vient de se terminer ou va se terminer. L'operateur ouvre le dossier client. Le systeme detecte que l'action attendue est de consigner la synthese d'appel, valider les informations utiles et preparer la transition vers l'etape suivante."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Etat general de l ecran' -Bold -Size 24),
  (New-ParagraphXml -Text "- Header : recherche client, compteurs de travail, bouton Ouvrir le dossier suivant."),
  (New-ParagraphXml -Text "- Bandeau client : nom, telephone, email, adresse du bien, type de bien, phase Qualification / avant-projet, statut call_requested ou call_done selon le moment exact."),
  (New-ParagraphXml -Text "- Bloc action attendue maintenant : Consigner la synthese d'appel et valider les prochaines etapes."),
  (New-ParagraphXml -Text "- Bouton principal : Ouvrir Marcel - mode compte-rendu d'appel."),
  (New-ParagraphXml -Text "- Boutons secondaires : Coller notes brutes, Reporter, Bloquer le dossier."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Colonne gauche : contexte de l appel' -Bold -Size 24),
  (New-ParagraphXml -Text "Cette colonne reste en lecture rapide et sert de memoire operateur pendant la saisie."),
  (New-ParagraphXml -Text "- Demande initiale du client."),
  (New-ParagraphXml -Text "- Historique du parcours jusqu'ici."),
  (New-ParagraphXml -Text "- Donnees deja connues : surface declaree, budget estime, echeance, type de bien, localisation."),
  (New-ParagraphXml -Text "- Fiche rendez-vous : date de l'appel, duree, statut, interlocuteur, source de prise de rendez-vous."),
  (New-ParagraphXml -Text "- Mini check-list visible : besoins compris, budget aborde, echeance confirmee, interet reel evalue, prochaine etape decidee."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Colonne centrale : espace de debrief d appel' -Bold -Size 24),
  (New-ParagraphXml -Text "Cette zone est le coeur du cas d'usage. Elle ne doit pas ressembler a un formulaire classique."),
  (New-ParagraphXml -Text "- Bloc A. Notes brutes : zone libre ou dictee pour coller ou saisir les mots cles de l'appel."),
  (New-ParagraphXml -Text "- Bloc B. Marcel structure : a partir des notes, Marcel propose une synthese organisee."),
  (New-ParagraphXml -Text "- Bloc C. Cartes de validation : chaque information critique est isolee dans une carte simple a valider ou corriger."),
  (New-ParagraphXml -Text "Cartes attendues : resume de l'appel, besoins identifies, budget confirme, echeance confirmee, niveau d'interet, contraintes, surface confirmee, duree estimee du scan, prochaine etape recommande."),
  (New-ParagraphXml -Text "Chaque carte offre trois actions : Valider, Corriger, Laisser vide."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Colonne droite : Marcel operateur en mode appel' -Bold -Size 24),
  (New-ParagraphXml -Text "- Mode de conversation force : compte-rendu d'appel."),
  (New-ParagraphXml -Text "- Marcel reformule, demande les zones d'ombre, propose une synthese professionnelle et explicite les points manquants."),
  (New-ParagraphXml -Text "- Sous la conversation, trois encarts fixes : Resume validable, Script client, Lecons globales candidates."),
  (New-ParagraphXml -Text "- Aucune ecriture durable n'est faite tant que l'operateur n'a pas clique sur Valider dans le dossier client."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Barre d actions finale' -Bold -Size 24),
  (New-ParagraphXml -Text "En bas de l'ecran, une barre de validation synthetise les decisions prises."),
  (New-ParagraphXml -Text "- Etat de la synthese : brouillon, a revoir, pret a enregistrer."),
  (New-ParagraphXml -Text "- Bouton principal : Valider la synthese d'appel."),
  (New-ParagraphXml -Text "- Bouton secondaire : Valider et envoyer l'invitation scan."),
  (New-ParagraphXml -Text "- Bouton alternatif : Programmer un rappel supplementaire."),
  (New-ParagraphXml -Text "- Bouton de sauvegarde : Enregistrer en brouillon."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Effets de validation attendus' -Bold -Size 24),
  (New-ParagraphXml -Text "Quand l'operateur valide la synthese, le systeme doit automatiquement :"),
  (New-ParagraphXml -Text "- enregistrer la note dans le dossier client comme synthese d'appel,"),
  (New-ParagraphXml -Text "- mettre a jour les champs derives necessaires au parcours,"),
  (New-ParagraphXml -Text "- faire evoluer la tache en cours vers terminee,"),
  (New-ParagraphXml -Text "- generer la tache suivante, par exemple Envoyer l'invitation scan,"),
  (New-ParagraphXml -Text "- si demande, preparer ou envoyer l'email d'invitation scan."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Trois sorties metier possibles' -Bold -Size 24),
  (New-ParagraphXml -Text "- Cas 1. Interet confirme : la synthese est validee, le dossier passe a l'etape suivante et l'invitation scan peut etre envoyee."),
  (New-ParagraphXml -Text "- Cas 2. Informations insuffisantes : la synthese est sauvee en brouillon et une tache de rappel est creee."),
  (New-ParagraphXml -Text "- Cas 3. Dossier en pause ou sans suite : la synthese est archivee, avec un motif clair et sans faire progresser artificiellement le pipeline."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Ce qu il faut absolument eviter' -Bold -Size 24),
  (New-ParagraphXml -Text "- Un formulaire long avec vingt champs successifs."),
  (New-ParagraphXml -Text "- Une page ou l'operateur doit naviguer entre plusieurs onglets pour finir une action simple."),
  (New-ParagraphXml -Text "- Une ecriture automatique dans le savoir global de Marcel sans validation humaine."),
  (New-ParagraphXml -Text "- Une confusion entre la phase metier visible et le statut technique du pipeline."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Principe directeur' -Bold -Size 24),
  (New-ParagraphXml -Text "Apres un appel, l'operateur doit pouvoir ouvrir un dossier, parler librement a Marcel, valider une synthese claire en quelques clics, puis declencher la suite logique du parcours sans ressaisir les memes informations.")
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

$buildRoot = Join-Path $env:TEMP ("wireframes_pilotage_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("wireframes_pilotage_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
