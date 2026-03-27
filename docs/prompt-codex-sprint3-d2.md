# Prompt Codex — Sprint 3 D-2 : Module agenda scan 3D dans l'espace utilisateur

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov — Phase 2 Étude/Avant-projet, prise de RDV scan 3D
**Statut:** D-1 complété (email d'invitation envoyé au prospect)
**Durée estimée:** 1-2 jours
**Dépendances:** D-1 complété, module B-3 (Calendly phone_call) opérationnel, table `appointments` (schéma v3)

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL — schéma v3, table `appointments` avec `type='scan_3d'`
**Auth:** Netlify Identity (`currentUser`, `currentClientId` disponibles dans `espace-client.html`)
**Calendrier:** Calendly embed iframe (même solution que B-3)

**Convention de code :**
- Netlify Functions : `const`/`let` (Node 18)
- Supabase admin : `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`
- Frontend : variable globale `supabaseClient` (déjà initialisée dans `espace-client.html`)
- Variable globale `currentClientId` disponible après chargement des données Supabase

**Statuts pipeline concernés :**
```
call_done         → prospect voit le module de prise de RDV scan
scan_scheduled    → RDV scan enregistré dans appointments, module de confirmation affiché
```

**Table `appointments` (schéma v3) :**
```sql
type     TEXT  -- 'phone_call' | 'scan_3d' | 'phone_offer'
status   TEXT  -- 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
location TEXT  -- adresse du bien (pour scan_3d)
```

---

## D-2 | Module agenda scan 3D dans l'espace utilisateur

**Fichiers à modifier / créer :**
- `espace-client.html` — section scan booking (nouvelle `phase-section`)
- `netlify/functions/book-scan.js` — nouveau endpoint de réservation

**Complexité :** Moyenne

### Contexte

Le module B-3 (prise de RDV téléphonique via Calendly) est déjà opérationnel dans `espace-client.html` pour les phases 1-2. Il faut maintenant créer un module **similaire pour le scan 3D**, visible uniquement pour le statut `call_done`.

Contrairement au RDV téléphonique, la prise de RDV scan est suivie d'un paiement en ligne (D-3). Le module doit donc :
1. Afficher le calendrier Calendly pour réserver un créneau scan
2. Après sélection du créneau, enregistrer le RDV dans `appointments` (type=`scan_3d`)
3. Afficher immédiatement la section paiement (D-3) sans changer de page
4. Masquer le calendrier et afficher un récapitulatif après validation du créneau

---

### Sous-tâches

**D-2a : Section HTML dans `espace-client.html` — prise de RDV scan**

Ajouter une nouvelle `phase-section` après la section `confirmedAppointmentsSection` existante.
La section est visible uniquement pour `call_done` (data-min-phase et data-max-phase basés sur le rang du statut — voir logique existante).

```html
<!-- ═══════════  PHASE CALL_DONE : PRISE DE RDV SCAN 3D (D-2)  ═══════════ -->
<div class="scan-booking-section phase-section" id="scanBookingSection"
     data-pipeline-status="call_done">
  <h3>Réserver votre scan 3D</h3>
  <p style="color:var(--text-soft);margin-bottom:20px;">
    Choisissez un créneau pour la réalisation de votre scan Matterport.
    La réservation sera confirmée après règlement de <strong>180 € TTC</strong>.
  </p>

  <!-- Info durée estimée (renseignée depuis project_notes) -->
  <div class="scan-duration-info" id="scanDurationInfo" style="display:none;
       margin-bottom:20px;padding:16px;background:#F5F9F6;border-radius:8px;
       border-left:4px solid #2D5F3E;">
    <p style="margin:0;font-size:0.9rem;color:#2D5F3E;">
      📐 <span id="scanDurationText">Durée estimée à confirmer lors de la prise de RDV</span>
    </p>
  </div>

  <!-- Calendly embed iframe — scan 3D -->
  <div id="scanCalendlyContainer" style="border-radius:8px;overflow:hidden;
       border:1px solid var(--border-color);min-height:700px;">
    <iframe
      src="https://calendly.com/scantorenov/scan-3d?hide_event_type_details=1&hide_gdpr_banner=1"
      width="100%"
      height="700"
      frameborder="0"
      style="border:none;"
      id="scanCalendlyIframe"
      title="Réserver un scan 3D">
    </iframe>
  </div>

  <!-- Carte de confirmation après sélection du créneau -->
  <div id="scanSlotSelected" style="display:none;margin-top:24px;
       padding:24px;border:1px solid #E8E8E8;border-radius:8px;background:#FBFAF7;">
    <h4 style="color:#2D5F3E;margin:0 0 12px 0;">✓ Créneau sélectionné</h4>
    <div id="scanSlotDetails" style="font-size:0.9rem;color:#5A5A5A;"></div>
    <p style="font-size:0.85rem;color:#9A9A9A;margin-top:12px;">
      Pour confirmer définitivement ce créneau, procédez au règlement ci-dessous.
    </p>
  </div>
</div>
```

**Note CSS à ajouter dans la section `<style>` existante :**
```css
.scan-booking-section {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #E8E8E8);
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
}
```

---

**D-2b : Logique d'affichage conditionnel par statut pipeline**

Le système de phases existant utilise `data-min-phase` / `data-max-phase` avec des entiers. Or les nouveaux statuts (`call_done`, `scan_scheduled`) sont des chaînes. Il faut adapter la logique de visibilité.

**Option recommandée** : ajouter un attribut `data-pipeline-status` sur les sections, et dans `renderPhase()`, ajouter une logique de masquage par statut texte en complément du système de phases.

Localiser la fonction `renderPhase()` dans `espace-client.html` et y ajouter, après la boucle des `phase-section` existante :

```javascript
// Gestion des sections par statut pipeline (data-pipeline-status)
var statusSections = document.querySelectorAll('[data-pipeline-status]');
statusSections.forEach(function(section) {
  var requiredStatus = section.getAttribute('data-pipeline-status');
  // La section est visible si le statut client correspond exactement
  // ou si on est dans une phase ultérieure (logique "au moins ce statut")
  var currentStatusRank = window.__pipelineRank ? window.__pipelineRank[currentPipelineStatus] : -1;
  var requiredRank = window.__pipelineRank ? window.__pipelineRank[requiredStatus] : -1;
  if (currentPipelineStatus === requiredStatus) {
    section.classList.add('phase-visible');
  } else {
    section.classList.remove('phase-visible');
  }
});
```

Ajouter aussi la variable globale `currentPipelineStatus` (en string) et le rank map :
```javascript
var currentPipelineStatus = ''; // initialisé dans showDashboard() depuis Supabase

// Dans showDashboard(), après récupération des données Supabase :
// currentPipelineStatus = sb.status || 'new_lead';
```

---

**D-2c : Listener postMessage Calendly pour scan 3D**

Étendre le listener `window.addEventListener('message', ...)` existant (déjà présent pour le RDV téléphonique) pour gérer les événements du calendrier scan :

```javascript
// Ajouter dans le listener postMessage existant, après la gestion 'appointmentBookingSection'
if (e.data.event === 'calendly.event_scheduled') {
  var sourceFrame = e.source;
  var scanIframe = document.getElementById('scanCalendlyIframe');
  if (scanIframe && scanIframe.contentWindow === sourceFrame) {
    handleScanSlotSelected(e.data.payload);
  }
}

function handleScanSlotSelected(payload) {
  console.log('📐 Scan 3D slot selected:', payload);

  var eventTitle = payload.event?.title || 'Scan 3D Matterport';
  var startTime = payload.event?.start_time;
  var startDate = startTime ? new Date(startTime) : null;

  var formattedDate = startDate
    ? startDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Date confirmée';
  var formattedTime = startDate
    ? startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Masquer le calendrier, afficher la carte récapitulatif
  var container = document.getElementById('scanCalendlyContainer');
  if (container) { container.style.opacity = '0.4'; container.style.pointerEvents = 'none'; }

  var slotSelected = document.getElementById('scanSlotSelected');
  var slotDetails = document.getElementById('scanSlotDetails');
  if (slotSelected && slotDetails) {
    slotDetails.innerHTML = `
      <p style="margin:0;"><strong>${eventTitle}</strong></p>
      <p style="margin:4px 0 0 0;">${formattedDate} à ${formattedTime}</p>`;
    slotSelected.style.display = 'block';
  }

  // Persister le créneau pour D-3 (paiement)
  window.__pendingScanSlot = { startTime, eventTitle };

  // Appeler book-scan.js pour enregistrer en base
  bookScanAppointment(startTime, eventTitle);
}
```

---

**D-2d : Créer `netlify/functions/book-scan.js`**

Endpoint POST, authentifié par JWT Netlify Identity (Bearer token).

```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { clientId, scheduledAt, durationMinutes, location, eventTitle } = JSON.parse(event.body || '{}');

    if (!clientId || !scheduledAt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId et scheduledAt requis' }) };
    }

    // Vérifier que le client est en statut call_done
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, status, adresse')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client introuvable' }) };
    }

    // Insérer le RDV scan dans appointments
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert([{
        client_id: clientId,
        type: 'scan_3d',
        status: 'requested',           // devient 'confirmed' après paiement D-3
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes || 90,
        location: location || client.adresse,
        notes: `Réservé via Calendly. Créneau: ${eventTitle || 'Scan 3D Matterport'}`,
      }])
      .select()
      .single();

    if (apptError) {
      console.error('Erreur INSERT appointment:', apptError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: apptError.message }) };
    }

    // Mettre à jour le statut client → scan_scheduled
    await supabase
      .from('clients')
      .update({ status: 'scan_scheduled', updated_at: new Date().toISOString() })
      .eq('id', clientId)
      .in('status', ['call_done']);  // N'écraser que si encore à call_done

    console.log(`✅ RDV scan créé : ${appt.id} pour client ${clientId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, appointmentId: appt.id, appointment: appt }),
    };
  } catch (err) {
    console.error('book-scan error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
```

---

**D-2e : Fonction frontend `bookScanAppointment()` dans `espace-client.html`**

```javascript
async function bookScanAppointment(scheduledAt, eventTitle) {
  if (!currentClientId) {
    console.warn('bookScanAppointment: currentClientId manquant');
    return null;
  }
  try {
    const resp = await fetch('/.netlify/functions/book-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: currentClientId,
        scheduledAt: scheduledAt,
        durationMinutes: 90,
        location: currentUser?.app_metadata?.adresse || '',
        eventTitle: eventTitle,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('bookScanAppointment error:', data.error);
      return null;
    }
    console.log('✅ RDV scan enregistré:', data.appointmentId);
    // Stocker l'appointmentId pour D-3 (paiement)
    window.__pendingScanAppointmentId = data.appointmentId;
    return data.appointmentId;
  } catch (err) {
    console.error('bookScanAppointment exception:', err);
    return null;
  }
}
```

---

**D-2f : Afficher la durée estimée depuis project_notes**

Dans `renderPhase()` ou dans la fonction qui charge les données Supabase, récupérer la durée depuis `project_notes` et l'afficher dans `scanDurationInfo` :

```javascript
async function loadScanDurationHint() {
  if (!supabaseClient || !currentClientId) return;
  const { data } = await supabaseClient
    .from('project_notes')
    .select('confirmed_surface')
    .eq('client_id', currentClientId)
    .eq('type', 'phone_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.confirmed_surface) {
    var surface = parseInt(data.confirmed_surface);
    var label = surface
      ? `Durée estimée : ${getScanDurationLabel(surface)} (surface ~${surface} m²)`
      : 'Durée estimée communiquée lors de la prise de RDV';
    var el = document.getElementById('scanDurationText');
    if (el) el.textContent = label;
    var info = document.getElementById('scanDurationInfo');
    if (info) info.style.display = '';
  }
}

function getScanDurationLabel(surface) {
  if (surface <= 50) return '45 min à 1h';
  if (surface <= 100) return '1h à 1h30';
  if (surface <= 200) return '1h30 à 2h30';
  return '2h30 à 3h';
}
```

Appeler `loadScanDurationHint()` depuis `renderPhase()` quand le statut est `call_done`.

---

**D-2g : Tests**

**Test 1 — Affichage conditionnel :**
- Mettre le statut d'un client test à `call_done` dans Supabase
- Se connecter → vérifier que `scanBookingSection` est visible, section RDV téléphonique masquée

**Test 2 — Sélection d'un créneau :**
- Cliquer sur l'iframe Calendly scan, sélectionner un créneau
- Vérifier que `handleScanSlotSelected()` se déclenche (console log)
- Vérifier que le créneau s'affiche dans la carte récapitulatif
- Vérifier dans Supabase : `appointments` contient une ligne `type='scan_3d'`, `status='requested'`
- Vérifier que `clients.status` est passé à `scan_scheduled`

**Test 3 — `book-scan.js` direct :**
```bash
curl -X POST https://<site>.netlify.app/.netlify/functions/book-scan \
  -H "Content-Type: application/json" \
  -d '{"clientId":"<uuid>","scheduledAt":"2026-04-15T10:00:00Z","durationMinutes":90}'
```

---

### Critères d'acceptation

- ✅ Section `scanBookingSection` visible uniquement pour les clients en statut `call_done`
- ✅ Iframe Calendly scan s'affiche correctement et propose des créneaux
- ✅ Après sélection, la carte récapitulatif s'affiche avec date/heure formatées en français
- ✅ Le RDV est inséré dans `appointments` avec `type='scan_3d'`, `status='requested'`
- ✅ Le statut client passe à `scan_scheduled` dans Supabase
- ✅ `window.__pendingScanAppointmentId` est renseigné pour D-3
- ✅ La durée estimée (depuis `project_notes`) s'affiche dans le bandeau info

---

## Validation D-2

Parcours complet :
1. Client en statut `call_done` se connecte à `espace-client.html`
2. La section "Réserver votre scan 3D" est visible
3. La durée estimée du scan apparaît dans le bandeau vert
4. Le client sélectionne un créneau dans le calendrier Calendly
5. La carte "Créneau sélectionné" s'affiche avec la date/heure
6. Supabase : `appointments` contient le RDV scan, `clients.status = 'scan_scheduled'`
7. La section de paiement (D-3) s'affiche immédiatement en dessous

---

## Notes pour Codex

- Ne pas modifier le module B-3 (RDV téléphonique) — créer un module séparé
- Réutiliser le style CSS existant (variables `--card-bg`, `--border-color`, `--text-soft`)
- Le lien Calendly scan `https://calendly.com/scantorenov/scan-3d` doit être configuré par Tarek dans Calendly avant déploiement (type de RDV distinct du téléphonique)
- Si le lien Calendly scan n'est pas encore créé, utiliser temporairement le même lien que le RDV téléphonique en ajoutant un commentaire `// TODO: remplacer par lien scan Calendly`
- Tester sur Chrome et Firefox

Bon courage! 🚀
