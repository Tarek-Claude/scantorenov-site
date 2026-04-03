param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\mapping-evenements-cycle-taches-preparation-dev.docx')
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

function Add-EventMapping {
  param(
    [string]$EventKey,
    [string]$Source,
    [string]$Creates,
    [string]$Closes,
    [string]$Reopens,
    [string]$TaskState,
    [string]$Proof,
    [string]$Screen,
    [string]$Notes
  )

  return @(
    (New-ParagraphXml -Text $EventKey -Bold -Size 24),
    (New-ParagraphXml -Text "Source : $Source"),
    (New-ParagraphXml -Text "Cree : $Creates"),
    (New-ParagraphXml -Text "Ferme : $Closes"),
    (New-ParagraphXml -Text "Reouvre : $Reopens"),
    (New-ParagraphXml -Text "Etat cible des taches : $TaskState"),
    (New-ParagraphXml -Text "Preuve / effet attendu : $Proof"),
    (New-ParagraphXml -Text "Ecran cible : $Screen"),
    (New-ParagraphXml -Text "Note de cadrage : $Notes"),
    (New-BlankParagraphXml)
  )
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$title = 'Mapping evenement systeme -> cycle de vie des task.type'

$paragraphs = New-Object System.Collections.Generic.List[string]

$intro = @(
  (New-ParagraphXml -Text $title -Bold -Size 32),
  (New-ParagraphXml -Text 'Date : 29 mars 2026' -Size 20),
  (New-ParagraphXml -Text "Objet : preparer le futur developpement du poste de pilotage interne en figeant le lien entre les evenements systeme, la creation des taches operateur, leur fermeture, leur reouverture et leur placement dans la vue transverse."),
  (New-ParagraphXml -Text "Documents reconsultes pour ce cadrage : Phasage-UX.docx et UX_validation-parcours-par-etapes.docx, recroises avec le pipeline technique actuel et les functions Netlify deja presentes."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '1. Decision de conception a retenir' -Bold -Size 28),
  (New-ParagraphXml -Text "Un evenement systeme ne vaut ni statut dossier, ni tache en lui-meme. Il alimente un moteur de taches. Le statut client reste la progression du dossier, tandis que la tache reste l'unite de travail operateur."),
  (New-ParagraphXml -Text "Conclusion : le developpement devra disposer d'un journal d'evenements clair et de regles idempotentes de creation / fermeture / reouverture de taches."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '2. Regles directrices pour le moteur de taches' -Bold -Size 28),
  (New-ParagraphXml -Text "- Un evenement peut creer plusieurs taches si elles ont des proprietaires ou des preuves de sortie differentes."),
  (New-ParagraphXml -Text "- Un evenement ne doit jamais creer des doublons de taches ouvertes pour un meme couple client_id + task.type, sauf si la regle dit explicitement qu'une nouvelle occurrence est necessaire."),
  (New-ParagraphXml -Text "- Toute fermeture de tache doit etre justifiable par une preuve observable : rendez-vous cree, paiement recu, synthese validee, fichier synchronise, message transmis."),
  (New-ParagraphXml -Text "- Toute reouverture doit porter une cause explicite : validation refusee, blocage leve, replanification, retour client incomplet."),
  (New-ParagraphXml -Text "- Les preuves d'onboarding doivent vivre dans une structure dediee. Elles ne doivent pas devenir une explosion de statuts client."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '3. Etats de taches utilises dans ce mapping' -Bold -Size 28),
  (New-ParagraphXml -Text "- open : l'operateur peut agir maintenant."),
  (New-ParagraphXml -Text "- awaiting_validation : quelque chose est produit et doit etre valide humainement."),
  (New-ParagraphXml -Text "- waiting_client : le dossier depend d'un retour, d'une piece, d'un arbitrage ou d'un paiement client."),
  (New-ParagraphXml -Text "- blocked : un obstacle interne, technique, fournisseur ou metier empeche l'avancement."),
  (New-ParagraphXml -Text "- done : la tache est terminee."),
  (New-ParagraphXml -Text "- cancelled : la tache est abandonnee ou devenue sans objet."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '4. Mapping des evenements - Contact et onboarding' -Bold -Size 28)
)

foreach ($p in $intro) { [void]$paragraphs.Add($p) }

$contactMappings = @()

$contactMappings += Add-EventMapping -EventKey 'contact_submitted' `
  -Source "contact.js ou formulaire de contact principal" `
  -Creates "lead_review" `
  -Closes "aucune tache par defaut" `
  -Reopens "lead_review si un lead deja connu revient avec de nouvelles informations" `
  -TaskState "lead_review en open" `
  -Proof "Lead cree ou mis a jour avec donnees minimales valides et trace du formulaire." `
  -Screen "cockpit qualification initiale" `
  -Notes "Cet evenement ne doit pas encore creer de taches de scan ou d'appel. Il ouvre seulement la porte d'entree du dossier."

$contactMappings += Add-EventMapping -EventKey 'identity_account_created' `
  -Source "Netlify Identity / flux signup de l'espace client" `
  -Creates "onboarding_nudge uniquement si stagnation future ; pas de tache humaine immediate par defaut" `
  -Closes "lead_review si le lead ne presente plus d'anomalie bloquante" `
  -Reopens "lead_review si l'association compte <-> client parait incoherente" `
  -TaskState "aucune tache immediate ; futur onboarding_nudge en waiting_client" `
  -Proof "Compte cree, email connu, client resolvable dans le systeme." `
  -Screen "suivi onboarding / vue transverse" `
  -Notes "Le moteur de taches ne doit pas surcharger l'operateur au simple moment de creation du compte."

$contactMappings += Add-EventMapping -EventKey 'onboarding_step_validated' `
  -Source "stepper UX de decouverte avec preuve active" `
  -Creates "aucune tache humaine par defaut" `
  -Closes "aucune tache humaine par defaut" `
  -Reopens "onboarding_validate_proof en cas d'incoherence de validation seulement" `
  -TaskState "pas de tache operateur normale ; eventuel onboarding_validate_proof en blocked ou open" `
  -Proof "Une preuve de progression est stockee pour la step concernee." `
  -Screen "ecran onboarding / suivi de progression" `
  -Notes "Cet evenement nourrit la preuve d'engagement, pas une action operateur quotidienne."

$contactMappings += Add-EventMapping -EventKey 'onboarding_completed' `
  -Source "fin du stepper avec l'ensemble des preuves requises" `
  -Creates "aucune tache immediate ; future client_followup_waiting ou onboarding_nudge si aucune reservation telephone n'arrive dans le delai cible" `
  -Closes "onboarding_nudge" `
  -Reopens "onboarding_nudge si l'achievement se revele invalide ou si le parcours doit etre refait" `
  -TaskState "fermeture de la relance existante ; sinon attente passive" `
  -Proof "Les validations de toutes les etapes sont presentes et l'acces a la prise de rendez-vous telephone est debride." `
  -Screen "cockpit qualification / transition vers rendez-vous telephone" `
  -Notes "La relecture du document UX_validation impose de distinguer clairement preuve d'onboarding et statut dossier."

foreach ($p in $contactMappings) { [void]$paragraphs.Add($p) }

[void]$paragraphs.Add((New-ParagraphXml -Text '5. Mapping des evenements - Appel telephone' -Bold -Size 28))

$phoneMappings = @()

$phoneMappings += Add-EventMapping -EventKey 'phone_appointment_booked' `
  -Source "book-appointment.js" `
  -Creates "phone_call_prepare" `
  -Closes "client_followup_waiting lie a la prise de rendez-vous telephone" `
  -Reopens "phone_call_prepare si le rendez-vous est replanifie" `
  -TaskState "phone_call_prepare en open" `
  -Proof "Appointment telephone cree avec date, heure et client resolu." `
  -Screen "ecran apres appel telephonique, mode preparation" `
  -Notes "C'est un vrai evenement createur de travail operateur, car il rend l'appel imminent et concret."

$phoneMappings += Add-EventMapping -EventKey 'phone_call_completed' `
  -Source "confirm-appointment.js ou validation admin de fin d'appel" `
  -Creates "phone_call_complete, puis phone_summary_validate si une synthese est proposee dans la foulee" `
  -Closes "phone_call_prepare" `
  -Reopens "phone_call_complete si l'appel doit etre repris ou complete" `
  -TaskState "phone_call_complete en awaiting_validation si de la matiere existe deja ; sinon open" `
  -Proof "Des notes brutes, un recap ou une synthese d'appel existent et sont rattaches au dossier." `
  -Screen "ecran apres appel telephonique" `
  -Notes "La fermeture de la preparation ne doit pas signifier que la synthese est deja validee."

$phoneMappings += Add-EventMapping -EventKey 'phone_summary_validated' `
  -Source "validation humaine d'une synthese d'appel, saisie manuelle ou assistee par Marcel" `
  -Creates "scan_invitation_send si le dossier est juge eligible au scan ; sinon client_followup_waiting ou blocker_resolve selon la decision" `
  -Closes "phone_call_complete, phone_summary_validate, marcel_output_validate associe" `
  -Reopens "phone_call_complete si la validation est refusee et necessite un complement" `
  -TaskState "scan_invitation_send en open ou attente ciblee selon la decision" `
  -Proof "Synthese validee, besoins et contraintes clarifies, prochaine etape decidee." `
  -Screen "ecran apres appel telephonique / decision" `
  -Notes "Cet evenement est la vraie charniere entre qualification et conversion vers le scan."

foreach ($p in $phoneMappings) { [void]$paragraphs.Add($p) }

[void]$paragraphs.Add((New-ParagraphXml -Text '6. Mapping des evenements - Scan, paiement et visite' -Bold -Size 28))

$scanMappings = @()

$scanMappings += Add-EventMapping -EventKey 'scan_invitation_sent' `
  -Source "invite-scan.js" `
  -Creates "scan_booking_followup" `
  -Closes "scan_invitation_send" `
  -Reopens "scan_invitation_send si l'envoi echoue ou doit etre refait" `
  -TaskState "scan_booking_followup en waiting_client" `
  -Proof "Invitation envoyee et tracee avec lien ou consigne de reservation." `
  -Screen "suivi scan & paiement / vue transverse" `
  -Notes "La reservation appartient ensuite au client ; le poste operateur doit donc surtout suivre et relancer."

$scanMappings += Add-EventMapping -EventKey 'scan_appointment_booked' `
  -Source "book-scan.js" `
  -Creates "scan_payment_followup" `
  -Closes "scan_booking_followup, client_followup_waiting lie a la reservation scan" `
  -Reopens "scan_booking_followup si le creneau est annule et qu'aucune nouvelle date n'est reprise" `
  -TaskState "scan_payment_followup en waiting_client ou open selon la logique de relance retenue" `
  -Proof "Appointment scan cree avec date, heure, contexte client et reference du creneau." `
  -Screen "suivi scan & paiement" `
  -Notes "La tache de suivi de paiement ne doit pas etre confondue avec la preparation de visite."

$scanMappings += Add-EventMapping -EventKey 'scan_checkout_created' `
  -Source "create-checkout.js" `
  -Creates "aucune nouvelle tache si scan_payment_followup existe deja" `
  -Closes "aucune tache par defaut" `
  -Reopens "scan_payment_followup si elle avait ete cloturee a tort" `
  -TaskState "scan_payment_followup reste en waiting_client" `
  -Proof "Session de paiement generee et communicable au client." `
  -Screen "suivi scan & paiement" `
  -Notes "Cet evenement enrichit la preuve de paiement en cours mais ne doit pas multiplier les taches."

$scanMappings += Add-EventMapping -EventKey 'scan_payment_completed' `
  -Source "webhook-stripe.js" `
  -Creates "scan_visit_prepare" `
  -Closes "scan_payment_followup, client_followup_waiting lie au paiement" `
  -Reopens "scan_payment_followup si le paiement est rembourse, invalide ou non rapproche" `
  -TaskState "scan_visit_prepare en open" `
  -Proof "Paiement recu, reference Stripe rapprochee, statut client coherent." `
  -Screen "pre-scan operations" `
  -Notes "C'est un evenement purement systeme mais a forte consequence operateur."

$scanMappings += Add-EventMapping -EventKey 'scan_confirmed' `
  -Source "confirm-scan.js ou confirmation operative de la visite" `
  -Creates "aucune nouvelle tache si scan_visit_prepare existe deja" `
  -Closes "aucune tache par defaut" `
  -Reopens "scan_visit_prepare si des elements logistiques manquent encore" `
  -TaskState "scan_visit_prepare reste en open jusqu'a visite tenue" `
  -Proof "Le scan est confirme, la logistique et les confirmations sont enregistrees." `
  -Screen "pre-scan operations" `
  -Notes "La confirmation ne vaut pas fin de preparation tant que la visite n'a pas eu lieu."

$scanMappings += Add-EventMapping -EventKey 'scan_visit_completed' `
  -Source "validation operateur de fin de visite ou future function de cloture terrain" `
  -Creates "scan_assets_sync" `
  -Closes "scan_visit_prepare" `
  -Reopens "scan_visit_prepare si la visite est finalement replanifiee ou incomplete" `
  -TaskState "scan_assets_sync en open" `
  -Proof "La visite a bien eu lieu et le dossier peut passer au traitement de la matiere scan." `
  -Screen "ecran scan_completed / traitement du scan" `
  -Notes "C'est l'entree du poste de transformation du scan en dossier exploitable."

$scanMappings += Add-EventMapping -EventKey 'scan_assets_synced' `
  -Source "synchronisation Matterport, import fichiers PC, rattachement iframe / modelId / CSV / photos" `
  -Creates "visit_summary_validate" `
  -Closes "scan_assets_sync" `
  -Reopens "scan_assets_sync si des assets manquent ou si la synchronisation est jugee insuffisante" `
  -TaskState "visit_summary_validate en awaiting_validation" `
  -Proof "Le dossier contient les assets utiles et la source du scan est exploitable." `
  -Screen "ecran scan_completed / traitement du scan" `
  -Notes "Ce point devra plus tard prendre en compte les limites reelles de l'automatisation Matterport."

$scanMappings += Add-EventMapping -EventKey 'visit_summary_validated' `
  -Source "validation humaine du compte-rendu de visite, manuel ou assiste par Marcel" `
  -Creates "analysis_build" `
  -Closes "visit_summary_validate, marcel_output_validate associe" `
  -Reopens "scan_assets_sync si la validation revele un manque de matiere" `
  -TaskState "analysis_build en open" `
  -Proof "Observations de visite validees, contraintes techniques clarifiees, contexte du dossier enrichi." `
  -Screen "ecran scan_completed / traitement du scan" `
  -Notes "Cette validation est le sas avant l'atelier d'analyse."

foreach ($p in $scanMappings) { [void]$paragraphs.Add($p) }

[void]$paragraphs.Add((New-ParagraphXml -Text '7. Mapping des evenements - Analyse et avant-projet' -Bold -Size 28))

$analysisMappings = @()

$analysisMappings += Add-EventMapping -EventKey 'analysis_draft_saved' `
  -Source "ecran analysis_ready / atelier d'analyse" `
  -Creates "analysis_validate si l'analyse atteint un niveau presentable" `
  -Closes "aucune tache par defaut" `
  -Reopens "analysis_build si une validation precedente a ete refusee" `
  -TaskState "analysis_build reste en open ou passe en awaiting_validation selon le niveau de maturite" `
  -Proof "Analyse en brouillon enregistree avec scenarios, hypotheses et points a arbitrer." `
  -Screen "ecran analysis_ready / atelier d'analyse" `
  -Notes "Le developpement devra figer un seuil de maturite clair pour savoir quand ouvrir analysis_validate."

$analysisMappings += Add-EventMapping -EventKey 'analysis_validated' `
  -Source "validation humaine de l'analyse" `
  -Creates "avant_project_finalize" `
  -Closes "analysis_build, analysis_validate, marcel_output_validate associe" `
  -Reopens "analysis_build si arbitrage incomplet ou validation refusee" `
  -TaskState "avant_project_finalize en open" `
  -Proof "Scenario retenu, analyse approuvee, sortie vers l'avant-projet decidee." `
  -Screen "ecran analysis_ready / atelier d'analyse" `
  -Notes "Cet evenement doit correspondre a une vraie decision metier, pas juste a un autosave."

$analysisMappings += Add-EventMapping -EventKey 'avant_project_draft_saved' `
  -Source "ecran avant_projet_ready / finalisation" `
  -Creates "marcel_output_validate ou verification interne si la matiere devient presentable" `
  -Closes "aucune tache par defaut" `
  -Reopens "avant_project_finalize si une version precedente a ete refusee" `
  -TaskState "avant_project_finalize reste en open ou passe en awaiting_validation selon la maturite" `
  -Proof "Version interne de l'avant-projet enregistree avec supports et message client en cours." `
  -Screen "ecran avant_projet_ready / finalisation" `
  -Notes "Comme pour l'analyse, il faut un seuil explicite entre brouillon et version a valider."

$analysisMappings += Add-EventMapping -EventKey 'avant_project_validated' `
  -Source "validation humaine de la version interne de l'avant-projet" `
  -Creates "avant_project_transmit" `
  -Closes "avant_project_finalize, marcel_output_validate associe" `
  -Reopens "avant_project_finalize si la validation est refusee ou si un element visuel manque" `
  -TaskState "avant_project_transmit en open" `
  -Proof "Version interne approuvee, message client clarifie, supports retenus." `
  -Screen "ecran avant_projet_ready / finalisation" `
  -Notes "La transmission ne doit pas etre confondue avec la validation interne."

$analysisMappings += Add-EventMapping -EventKey 'avant_project_transmitted' `
  -Source "submit-avantprojet.js ou action de transmission journalisee" `
  -Creates "offer_discussion_prepare ou client_followup_waiting selon la suite commerciale retenue" `
  -Closes "avant_project_transmit" `
  -Reopens "avant_project_transmit si l'envoi echoue ou si une nouvelle version doit etre renvoyee" `
  -TaskState "offer_discussion_prepare en open ou client_followup_waiting en waiting_client" `
  -Proof "Transmission enregistree, version client figee, prochaine suite connue." `
  -Screen "ecran avant_projet_ready / finalisation puis vue transverse" `
  -Notes "C'est le point de sortie du bloc avant-projet et l'entree du bloc accompagnement potentiel."

foreach ($p in $analysisMappings) { [void]$paragraphs.Add($p) }

[void]$paragraphs.Add((New-ParagraphXml -Text '8. Mapping des evenements - Accompagnement et coordination' -Bold -Size 28))

$coordinationMappings = @()

$coordinationMappings += Add-EventMapping -EventKey 'accompaniment_activated' `
  -Source "activation de l'offre, paiement ou validation commerciale menant a accompaniment_subscribed" `
  -Creates "accompaniment_kickoff" `
  -Closes "offer_discussion_prepare" `
  -Reopens "offer_discussion_prepare si l'activation est retiree ou suspendue avant kickoff" `
  -TaskState "accompaniment_kickoff en open" `
  -Proof "Offre active, accord ou paiement trace, dossier passe en accompagnement." `
  -Screen "ecran accompaniment_subscribed / coordination active" `
  -Notes "Le statut accompaniment_subscribed doit se traduire par un vrai demarrage operateur, pas seulement un affichage client."

$coordinationMappings += Add-EventMapping -EventKey 'accompaniment_roadmap_created' `
  -Source "creation de la feuille de route d'accompagnement" `
  -Creates "accompaniment_coordinate" `
  -Closes "accompaniment_kickoff" `
  -Reopens "accompaniment_kickoff si la feuille de route est jugee incomplete" `
  -TaskState "accompaniment_coordinate en open" `
  -Proof "Feuille de route creee, premier jalon programme, responsabilites clarifiees." `
  -Screen "ecran accompaniment_subscribed / coordination active" `
  -Notes "Le cockpit quotidien prendra ensuite le relai avec des occurrences successives de coordination."

$coordinationMappings += Add-EventMapping -EventKey 'coordination_milestone_completed' `
  -Source "validation d'un jalon d'accompagnement" `
  -Creates "nouvelle occurrence de accompaniment_coordinate ou client_followup_waiting selon l'etape suivante" `
  -Closes "occurrence courante de accompaniment_coordinate" `
  -Reopens "accompaniment_coordinate si le jalon est invalide ou incomplet" `
  -TaskState "nouvelle tache en open ou waiting_client" `
  -Proof "Decision ou livrable du jalon valide et prochain pas explicite." `
  -Screen "ecran accompaniment_subscribed / coordination active puis vue transverse" `
  -Notes "Ce mecanisme permet d'avoir une coordination vivante sans confondre toute la phase avec une seule tache infinie."

foreach ($p in $coordinationMappings) { [void]$paragraphs.Add($p) }

[void]$paragraphs.Add((New-ParagraphXml -Text '9. Mapping des evenements transverses' -Bold -Size 28))

$transverseMappings = @()

$transverseMappings += Add-EventMapping -EventKey 'client_reply_received' `
  -Source "email, formulaire, action client dans l'espace ou information saisie par operateur" `
  -Creates "aucune nouvelle tache par defaut" `
  -Closes "client_followup_waiting lie a la question traquee" `
  -Reopens "tache metier precedente si le retour rend l'action de nouveau possible" `
  -TaskState "la tache metier precedente repasse en open" `
  -Proof "Retour client trace et relie a la demande initiale." `
  -Screen "vue transverse puis ecran metier cible" `
  -Notes "Il faudra plus tard une liaison explicite entre la tache d'attente et la tache metier qu'elle suspend."

$transverseMappings += Add-EventMapping -EventKey 'client_reply_missing_sla' `
  -Source "vieillissement de tache ou automation de suivi" `
  -Creates "client_followup_waiting si elle n'existe pas deja" `
  -Closes "aucune tache par defaut" `
  -Reopens "client_followup_waiting si elle avait ete cloturee mais que l'absence de retour persiste" `
  -TaskState "client_followup_waiting en waiting_client avec priorite croissante" `
  -Proof "SLA depasse constate, prochaine relance ou reprise decidee." `
  -Screen "vue transverse / En attente client" `
  -Notes "La priorisation devra croitre avec l'age et la valeur du dossier."

$transverseMappings += Add-EventMapping -EventKey 'blocker_detected' `
  -Source "bascule manuelle ou systeme d'une tache en blocked" `
  -Creates "blocker_resolve" `
  -Closes "aucune tache par defaut" `
  -Reopens "blocker_resolve si un meme blocage revient" `
  -TaskState "tache metier source en blocked ; blocker_resolve en open" `
  -Proof "Motif de blocage explicite, responsable cible et action de resolution identifies." `
  -Screen "vue transverse / Bloques puis dossier cible" `
  -Notes "Je recommande de stocker la reference de la tache bloquee dans blocker_resolve."

$transverseMappings += Add-EventMapping -EventKey 'blocker_resolved' `
  -Source "resolution confirmee du blocage" `
  -Creates "aucune tache nouvelle par defaut" `
  -Closes "blocker_resolve" `
  -Reopens "la tache metier prealablement bloquee" `
  -TaskState "la tache metier repasse en open ou awaiting_validation selon son etat precedent" `
  -Proof "Cause du blocage levee et reprise possible du flux." `
  -Screen "vue transverse puis ecran metier cible" `
  -Notes "Le systeme devra memoriser l'etat precedent pour savoir comment reouvrir proprement."

$transverseMappings += Add-EventMapping -EventKey 'marcel_output_proposed' `
  -Source "panneau Marcel operateur sur n'importe quel ecran metier" `
  -Creates "marcel_output_validate" `
  -Closes "aucune tache metier par defaut" `
  -Reopens "marcel_output_validate si une version corrigee est reproposee" `
  -TaskState "marcel_output_validate en awaiting_validation" `
  -Proof "Une sortie exploitable existe : synthese, recap, analyse, message client, feuille de route." `
  -Screen "ecran metier source ou panneau Marcel operateur" `
  -Notes "Il faut garder une validation humaine explicite avant toute ecriture durable ou exposition client."

$transverseMappings += Add-EventMapping -EventKey 'marcel_output_rejected' `
  -Source "validation humaine negative sur une proposition Marcel" `
  -Creates "aucune nouvelle tache par defaut" `
  -Closes "marcel_output_validate si la proposition est abandonnee" `
  -Reopens "tache metier source, par exemple phone_call_complete, visit_summary_validate, analysis_build ou avant_project_finalize" `
  -TaskState "la tache metier source repasse en open" `
  -Proof "Motif de refus consigne et prochain retravail explicite." `
  -Screen "ecran metier source" `
  -Notes "Le rejet doit renvoyer vers le vrai travail a refaire, pas laisser le dossier dans un vide logique."

foreach ($p in $transverseMappings) { [void]$paragraphs.Add($p) }

$outro = @(
  (New-ParagraphXml -Text '10. Regles a figer avant de developper' -Bold -Size 28),
  (New-ParagraphXml -Text "- Nom exact des evenements emises par les functions, le front et les actions operateur."),
  (New-ParagraphXml -Text "- Strategie d'idempotence : un meme evenement ne doit pas creer plusieurs taches ouvertes identiques."),
  (New-ParagraphXml -Text "- Regles de reouverture : quel etat precedent restaurer et a quel moment."),
  (New-ParagraphXml -Text "- Relation entre une tache d'attente, une tache bloquee et la tache metier source."),
  (New-ParagraphXml -Text "- Format minimal d'une preuve associee a chaque fermeture de tache."),
  (New-ParagraphXml -Text "- SLA et regles de vieillissement pour waiting_client."),
  (New-ParagraphXml -Text "- Cas ou plusieurs occurrences d'un meme task.type sont autorisees."),
  (New-BlankParagraphXml),
  (New-ParagraphXml -Text '11. Recommandation finale' -Bold -Size 28),
  (New-ParagraphXml -Text "La prochaine specification utile serait un schema de donnees minimal pour admin_tasks, task_events et onboarding_step_validations, complete par une table des regles d'automatisation. Avec ce triptyque, le developpement du cockpit operateur pourra demarrer sur une base stable.")
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

$buildRoot = Join-Path $env:TEMP ("mapping_evenements_cycle_taches_docx_" + [guid]::NewGuid().ToString())
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

$zipPath = Join-Path $env:TEMP ("mapping_evenements_cycle_taches_docx_" + [guid]::NewGuid().ToString() + '.zip')
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $buildRoot '*') -DestinationPath $zipPath -Force
Move-Item -Path $zipPath -Destination $OutputPath -Force
Remove-Item $buildRoot -Recurse -Force

Write-Output $OutputPath
