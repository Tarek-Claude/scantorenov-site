param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\wireframe-poste-pilotage-interne-vue-transverse.docx')
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
$title = 'Wireframe detaille - Poste de pilotage interne - Vue transverse quotidienne'

$paragraphs = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : definir l'ecran d'entree quotidien du poste de pilotage interne, centre sur les taches a traiter, les validations, les attentes client et les blocages. Ce document est pense pour preparer le developpement ulterieur sans encore entrer dans la production."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Raison d etre de la vue transverse' -Bold -Size 28),
  (New-ParagraphXml -Text "Cette vue n'est pas un simple tableau de bord. Elle doit etre le point d'entree naturel de l'operateur quand il ouvre son espace de travail."),
  (New-ParagraphXml -Text "- voir en quelques secondes ce qui doit etre fait aujourd'hui,"),
  (New-ParagraphXml -Text "- comprendre ce qui attend une validation,"),
  (New-ParagraphXml -Text "- distinguer les dossiers bloques des dossiers en attente client,"),
  (New-ParagraphXml -Text "- ouvrir immediatement le bon dossier avec le bon niveau de contexte."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Principe directeur' -Bold -Size 28),
  (New-ParagraphXml -Text "La vue transverse doit repondre a cinq questions sans effort :"),
  (New-ParagraphXml -Text "- qu'est-ce que je dois traiter maintenant ?"),
  (New-ParagraphXml -Text "- qu'est-ce qui attend ma validation ?"),
  (New-ParagraphXml -Text "- qu'est-ce qui est bloque chez le client ?"),
  (New-ParagraphXml -Text "- quels dossiers derapent ou arrivent a echeance ?"),
  (New-ParagraphXml -Text "- sur quel client dois-je entrer pour agir ?"),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Structure generale de l ecran' -Bold -Size 28),
  (New-ParagraphXml -Text "Je recommande une structure en trois niveaux lisibles."),
  (New-ParagraphXml -Text "- Niveau 1 : barre haute de pilotage."),
  (New-ParagraphXml -Text "- Niveau 2 : resume des flux de travail du jour."),
  (New-ParagraphXml -Text "- Niveau 3 : quatre colonnes principales de taches."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Barre haute de pilotage' -Bold -Size 24),
  (New-ParagraphXml -Text "La barre haute doit cumuler la recherche client et la lecture de charge."),
  (New-ParagraphXml -Text "- Champ de recherche toujours visible : nom, prenom, email, telephone."),
  (New-ParagraphXml -Text "- Bouton Ouvrir le dossier suivant prioritaire."),
  (New-ParagraphXml -Text "- Filtres rapides : phase, statut, type de tache, priorite, echeance, responsable."),
  (New-ParagraphXml -Text "- Toggle personnel : mes taches uniquement / toutes les taches equipe."),
  (New-ParagraphXml -Text "- Compteurs instantanes : 12 a faire, 4 a valider, 7 en attente client, 3 bloques."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '5. Resume des flux du jour' -Bold -Size 24),
  (New-ParagraphXml -Text "Sous la barre haute, je mettrais une bande de lecture rapide du travail du jour."),
  (New-ParagraphXml -Text "- Taches echeance aujourd'hui."),
  (New-ParagraphXml -Text "- Dossiers sans mouvement depuis X jours."),
  (New-ParagraphXml -Text "- Dossiers a fort enjeu ou a fort risque."),
  (New-ParagraphXml -Text "- Dernieres validations effectuees."),
  (New-ParagraphXml -Text "- Alertes de systeme : paiement, scan incomplet, rendez-vous proche, document manquant."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '6. Les quatre colonnes de travail' -Bold -Size 24),
  (New-ParagraphXml -Text "Je recommande une organisation en quatre colonnes stables, qui correspondent a la realite du travail quotidien."),
  (New-ParagraphXml -Text "Colonne 1. A faire"),
  (New-ParagraphXml -Text "- toutes les taches actionnables maintenant par l'operateur ou l'equipe,"),
  (New-ParagraphXml -Text "- elles ont un bouton d'action clair et une prochaine etape definie."),
  (New-ParagraphXml -Text "Colonne 2. A valider"),
  (New-ParagraphXml -Text "- syntheses, analyses, messages, decisions ou publications qui demandent un accord humain."),
  (New-ParagraphXml -Text "Colonne 3. En attente client"),
  (New-ParagraphXml -Text "- arbitrages, pieces, confirmations ou retours attendus du client."),
  (New-ParagraphXml -Text "Colonne 4. Bloques"),
  (New-ParagraphXml -Text "- dossiers impossibles a faire avancer sans resolution particuliere, interne ou externe."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '7. Design d une carte de tache' -Bold -Size 24),
  (New-ParagraphXml -Text "Chaque carte doit etre autoporteuse. Elle doit eviter a l'operateur d'ouvrir un dossier juste pour comprendre ce qu'il se passe."),
  (New-ParagraphXml -Text "- Nom du client."),
  (New-ParagraphXml -Text "- Phase metier lisible."),
  (New-ParagraphXml -Text "- Statut pipeline technique."),
  (New-ParagraphXml -Text "- Type de tache : appel, synthese, scan, validation, relance, transmission, coordination."),
  (New-ParagraphXml -Text "- Intitule tres concret : Envoyer l'invitation scan, Valider la synthese d'appel, Attendre les plans du client."),
  (New-ParagraphXml -Text "- Date cible ou retard cumule."),
  (New-ParagraphXml -Text "- Niveau de priorite."),
  (New-ParagraphXml -Text "- Preuve attendue ou condition de sortie."),
  (New-ParagraphXml -Text "- Bouton principal : Ouvrir le dossier / Agir / Valider."),
  (New-ParagraphXml -Text "- Bouton secondaire : Demander a Marcel / Reporter / Marquer bloque."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '8. Regles de priorisation recommandees' -Bold -Size 24),
  (New-ParagraphXml -Text "Pour que la vue soit utile, les cartes doivent etre triees selon des regles simples et assumables."),
  (New-ParagraphXml -Text "- Priorite 1 : taches dues aujourd'hui ou en retard."),
  (New-ParagraphXml -Text "- Priorite 2 : validations bloquantes pour la suite du parcours."),
  (New-ParagraphXml -Text "- Priorite 3 : taches a forte valeur client ou a forte tension calendrier."),
  (New-ParagraphXml -Text "- Priorite 4 : taches de confort ou d'entretien du dossier."),
  (New-ParagraphXml -Text "Je recommande d'afficher le motif de priorite directement dans la carte : En retard de 3 jours, Validation bloquante, RDV demain, Attente client depuis 6 jours."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '9. Difference fondamentale entre statut dossier et statut tache' -Bold -Size 24),
  (New-ParagraphXml -Text "Ce point doit etre fige avant le developpement."),
  (New-ParagraphXml -Text "- Le dossier client a un statut pipeline unique a un instant donne."),
  (New-ParagraphXml -Text "- Mais plusieurs taches peuvent coexister autour de ce dossier."),
  (New-ParagraphXml -Text "- Une tache peut etre ouverte, en attente, en validation, terminee, annulee ou bloquee sans que le statut dossier change immediatement."),
  (New-ParagraphXml -Text "Conclusion : il faut penser la vue transverse depuis une logique `admin_tasks`, et non seulement depuis les statuts clients."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '10. Mode de navigation recommande' -Bold -Size 24),
  (New-ParagraphXml -Text "L'operateur doit pouvoir agir vite sans se perdre."),
  (New-ParagraphXml -Text "- Clic sur une carte : ouvre le dossier sur le bon ecran et sur le bon mode."),
  (New-ParagraphXml -Text "- Retour automatique a la vue transverse apres validation si souhaite."),
  (New-ParagraphXml -Text "- Bouton Dossier suivant pertinent pour enchainer le travail."),
  (New-ParagraphXml -Text "- Historique des derniers dossiers ouverts pour eviter les recherches repetitives."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '11. Rôle de Marcel dans la vue transverse' -Bold -Size 24),
  (New-ParagraphXml -Text "Marcel ne doit pas etre l'element central de la vue transverse, mais il doit accelerer la prise de decision."),
  (New-ParagraphXml -Text "- sur une carte : Demander a Marcel un recap du blocage ou de la prochaine action,"),
  (New-ParagraphXml -Text "- sur une validation : demander une reformulation du message ou du compte-rendu,"),
  (New-ParagraphXml -Text "- sur un dossier en attente : demander une relance client preparee."),
  (New-ParagraphXml -Text "- sur un dossier bloque : demander une analyse des points de friction."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '12. Cas d usage concrets de la vue transverse' -Bold -Size 24),
  (New-ParagraphXml -Text "Cas 1. Debut de journee"),
  (New-ParagraphXml -Text "- l'operateur ouvre son cockpit, voit 5 taches dues aujourd'hui et 2 validations bloquantes, puis ouvre la premiere carte prioritaire."),
  (New-ParagraphXml -Text "Cas 2. Retour d'un appel"),
  (New-ParagraphXml -Text "- la tache passe automatiquement en A valider si une synthese est proposee par Marcel."),
  (New-ParagraphXml -Text "Cas 3. Client silencieux"),
  (New-ParagraphXml -Text "- la carte bascule en En attente client avec compteur de jours d'inactivite."),
  (New-ParagraphXml -Text "Cas 4. Incident ou piece manquante"),
  (New-ParagraphXml -Text "- la carte bascule en Bloques avec motif explicite et prochaine action de deblocage."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '13. Ce qu il faut figer avant de developper' -Bold -Size 24),
  (New-ParagraphXml -Text "Je recommande de figer avant toute production les points suivants."),
  (New-ParagraphXml -Text "- la liste des types de taches autorises,"),
  (New-ParagraphXml -Text "- les etats possibles d'une tache,"),
  (New-ParagraphXml -Text "- les regles de generation automatique des taches par statut et evenement,"),
  (New-ParagraphXml -Text "- les regles de priorisation,"),
  (New-ParagraphXml -Text "- les actions rapides autorisees depuis une carte,"),
  (New-ParagraphXml -Text "- les ecritures que Marcel peut proposer et celles qu'il ne peut jamais publier seul,"),
  (New-ParagraphXml -Text "- les conditions de passage d'une colonne a l'autre."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '14. Preparation technique recommandee sans coder encore' -Bold -Size 24),
  (New-ParagraphXml -Text "Pour preparer proprement le developpement plus tard, je recommande de definir sur papier le schema minimal suivant."),
  (New-ParagraphXml -Text "- table ou objet `admin_tasks` : id, client_id, type, title, status, priority, due_at, owner, blocking_reason, expected_proof, created_from, created_at, updated_at."),
  (New-ParagraphXml -Text "- mapping `client.status -> taches generees par defaut`."),
  (New-ParagraphXml -Text "- mapping `task.type -> ecran cible du dossier`."),
  (New-ParagraphXml -Text "- regles de vieillissement : quand une tache devient en retard, en attente client ou bloquee."),
  (New-ParagraphXml -Text "- catalogue des messages systeme et des alertes automatiques."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '15. Ce qu il faut eviter' -Bold -Size 24),
  (New-ParagraphXml -Text "- Un tableau trop abstrait ou trop administratif."),
  (New-ParagraphXml -Text "- Une vue qui liste des clients au lieu de lister du travail actionnable."),
  (New-ParagraphXml -Text "- Une confusion entre blocage, attente client et validation humaine."),
  (New-ParagraphXml -Text "- Une priorisation invisible ou arbitraire."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '16. Principe directeur final' -Bold -Size 24),
  (New-ParagraphXml -Text "La vue transverse quotidienne doit etre le veritable cockpit de l'operateur. Elle ne doit pas montrer tout le systeme ; elle doit montrer le travail utile maintenant, avec assez de contexte pour agir vite, valider juste et ouvrir le bon dossier au bon moment.")
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

$buildRoot = Join-Path $env:TEMP ("wireframe_vue_transverse_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("wireframe_vue_transverse_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
