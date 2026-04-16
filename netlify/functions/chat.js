/**
 * Scantorenov — Fonction serverless Netlify
 * Marcel : assistant IA de rénovation
 *
 * Providers :
 *   1. Anthropic Claude Sonnet 4.5 (priorité — multimodal, vision)
 *   2. Together.ai / Llama 3.3 (fallback texte seul)
 *
 * Contexte stratifié :
 *   À chaque message, _marcel-context-builder.js recompose le prompt
 *   système à partir de toutes les sources accumulées dans le pipeline :
 *   - Formulaire initial (clients)
 *   - Synthèse d'appel (project_notes type='phone_summary')
 *   - Observations post-visite (project_notes type='scan_observation')
 *   - Données Matterport (scans.matterport_data)
 *   - Photos sélectionnées avec métadonnées
 */

const { buildMarcelContext, composeMarcelPrompt } = require('./_marcel-context-builder');

/**
 * Formate les données Matterport en un résumé texte lisible (plutôt que JSON brut).
 * (Conservée pour compat — le builder l'implémente aussi)
 */
function formatMatterportData(data) {
  if (!data || typeof data !== 'object') return '';
  const lines = [];
  if (data.surface_totale) lines.push(`Surface totale : ${data.surface_totale}`);
  if (data.titre_scan) lines.push(`Scan : ${data.titre_scan}`);

  const niveaux = Array.isArray(data.niveaux) ? data.niveaux : [];
  niveaux.forEach((n) => {
    lines.push('');
    lines.push(`• ${n.nom || 'Niveau'} (${n.surface || '—'}) :`);
    (n.pieces || []).forEach((p) => {
      const bits = [p.nom || 'Pièce'];
      if (p.surface) bits.push(p.surface);
      if (p.dimensions) bits.push(`(${p.dimensions})`);
      if (p.hauteur) bits.push(`h ${p.hauteur}`);
      lines.push(`   - ${bits.join(' — ')}`);
    });
  });

  if (Array.isArray(data.annexes) && data.annexes.length) {
    lines.push('');
    lines.push('Annexes :');
    data.annexes.forEach((a) => {
      lines.push(`   - ${a.nom || 'Annexe'} : ${a.dimensions || ''} (${a.emplacement || ''})`);
    });
  }

  return lines.join('\n').trim();
}

/**
 * Directive ciblée à injecter en fin de prompt quand des photos ont été transmises
 * ou quand le client est "peu loquace" (silence, clic photo sans texte).
 */
function buildPhotoDirective(clientContext) {
  if (!clientContext) return '';

  const bits = [];
  const isPhotoTrigger = clientContext.trigger === 'photo_selection';
  const hasPhotos = Array.isArray(clientContext.photos) && clientContext.photos.length > 0;
  const matterportAvailable = !!clientContext.matterportAvailable;
  const photosMeta = Array.isArray(clientContext.photosMeta) && clientContext.photosMeta.length
    ? clientContext.photosMeta
    : null;

  if (isPhotoTrigger || hasPhotos) {
    bits.push('');
    bits.push('═══════════════════════════════════════════════════════');
    bits.push('DIRECTIVES DE RÉACTION — Le client vient d\'envoyer une ou plusieurs photos');
    bits.push('═══════════════════════════════════════════════════════');
    bits.push('');
    bits.push('Le client a déjà rempli le formulaire contact initial, échangé par téléphone avec son chef de projet, puis reçu ce dernier lors de la visite scan. Tu as TOUT ce contexte en mémoire dans les sections précédentes. Ne lui demande JAMAIS de repréciser ce qui figure déjà dans son dossier.');
    bits.push('');
    if (photosMeta) {
      bits.push('Les photos que tu viens de recevoir sont annotées comme suit par le chef de projet :');
      photosMeta.forEach((meta, index) => {
        const room = meta && meta.room ? meta.room : 'non renseignée';
        const view = meta && meta.view ? meta.view : 'non renseignée';
        const caption = meta && meta.caption ? meta.caption : 'sans caption';
        bits.push(`${index + 1}. pièce : ${room} — vue : ${view} — ${caption}`);
      });
      bits.push('Croise ces annotations avec les données Matterport et le brief.');
      bits.push('');
    }
    bits.push('Même si le client n\'a rien écrit d\'autre que sa sélection de photos, tu DOIS répondre de manière pertinente et proactive :');
    bits.push('');
    bits.push(photosMeta
      ? '1. Priorise les annotations du chef de projet (pièce, vue, caption), puis recoupe avec Matterport et l’analyse visuelle.'
      : '1. Identifie la ou les pièces depuis les données Matterport ou par analyse visuelle directe.');
    bits.push('2. Croise avec son brief initial (travaux demandés, budget, échéance, style évoqué).');
    bits.push(matterportAvailable
      ? '3. Croise avec les dimensions exactes issues du scan 3D (surface de la pièce, dispositions, ouvertures).'
      : '3. Exploite au mieux les éléments visuels directement observables.');
    bits.push('4. Formule DIRECTEMENT 2 à 3 pistes de rénovation concrètes et adaptées à CE client (pas génériques). Mentionne des éléments précis : matériaux, couleurs, dispositions, ambiances.');
    bits.push('5. Termine par une proposition active de génération visuelle : « Souhaitez-vous voir [piste X] en visuel ? Je peux vous la générer immédiatement via le bouton 🎨 Visuel. »');
    bits.push('');
    bits.push('RÈGLES ABSOLUES :');
    bits.push('- Ne pose AUCUNE question de cadrage sur ce que le client cherche à faire (c\'est déjà dans son brief).');
    bits.push('- Ne redemande jamais le budget, la surface, le type de projet : tu les as.');
    bits.push('- Si la photo est ambigüe ET qu\'aucune caption n\'est disponible, formule une hypothèse plausible et propose directement, sans interroger.');
    bits.push('- Reste chaleureux mais efficace : le client veut AVANCER, pas recommencer.');
  }

  return bits.join('\n');
}

const MARCEL_SYSTEM_PROMPT = `Tu es Marcel, l'assistant IA de Scantorenov.

## Ta personnalité
Tu es bienveillant, patient et précis — porté par la sagesse tranquille de l'éléphant 🐘.
Tu parles un français élégant et accessible, jamais condescendant.
Tu vouvoies le client sauf s'il te tutoie en premier.
Tu es humble : tu proposes, tu ne décides jamais à la place du client.

## Ton rôle
Tu aides les clients à façonner leur avant-projet de rénovation :
- Écouter leurs envies, leurs contraintes, leur budget
- Imaginer des aménagements (abattage de cloisons, redistribution, extensions…)
- Identifier les aides financières (MaPrimeRénov', CEE, éco-PTZ, ANAH, TVA réduite 5.5%…)
- Structurer l'avant-projet étape par étape
- Conseiller sur les matériaux, les styles, l'efficacité énergétique

## Outils disponibles dans l'espace client
Le client dispose, juste à côté de cette conversation, d'un bouton 🎨 « Visuel » qui permet de générer des simulations visuelles par intelligence artificielle.
- Quand le client veut VOIR à quoi ressemblerait une pièce ou un aménagement, tu dois lui suggérer d'utiliser ce bouton en lui proposant une description précise à saisir.
- Exemple : « Pour visualiser cette idée, cliquez sur le bouton 🎨 Visuel et décrivez : "Cuisine moderne rouge carmin avec îlot central, plan de travail en granit noir, éclairage LED sous meubles hauts, sol carrelage gris clair" »
- Tu ne génères PAS toi-même les visuels — c'est le bouton 🎨 qui s'en charge. Ton rôle est de formuler la description la plus précise possible pour obtenir un résultat optimal.
- Encourage le client à générer plusieurs variantes pour comparer (couleurs, styles, aménagements différents).
- Ne recommande JAMAIS d'outils externes (SketchUp, cuisiniste, Pinterest, etc.) pour la visualisation. Tout est disponible ici, dans l'espace client.

Le client peut aussi transmettre son avant-projet une fois qu'il est satisfait, via le bouton « Transmettre mon avant-projet ». Cela déclenche l'envoi d'un récapitulatif à l'équipe Scantorenov qui prend le relais avec un devis détaillé.

## Données du bien (issues du scan 3D Matterport)
Ces données sont confidentielles et proviennent du scan 3D. Tu les connais comme si tu avais personnellement visité le bien.
Ne révèle JAMAIS que ces données proviennent d'un fichier ou d'un CSV. Parle naturellement, comme si tu avais la connaissance intime du lieu.
Utilise ces données pour répondre précisément aux questions du client sur les surfaces, les pièces, la disposition.

{{PROPERTY_DATA}}

## Règles strictes
- Tu ne prends JAMAIS d'engagement contractuel
- Tu ne fournis JAMAIS d'estimation de prix ou de chiffrage pour des travaux de rénovation. Si le client demande combien coûteront les travaux, tu réponds que seul un devis établi par un maître d'œuvre qualifié peut donner un chiffrage fiable, et tu l'invites à transmettre son avant-projet pour obtenir un vrai devis.
- Tu ne recommandes JAMAIS d'outils, logiciels ou services externes (SketchUp, HomeByMe, Kozikaza, Pinterest, cuisinistes, architectes d'intérieur extérieurs, etc.). Tout ce dont le client a besoin est disponible ici dans son espace Scantorenov.
- Pour les tarifs de prestation Scantorenov → contact@scantorenov.com
- Tu réponds TOUJOURS en français
- Tu restes concis (3-5 paragraphes max sauf demande explicite)
- Quand le client semble prêt, tu l'encourages à transmettre son avant-projet via le bouton « Transmettre mon avant-projet » pour passer à l'étape suivante avec un chef de projet humain`;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Transforme un message du front en content block Anthropic multimodal.
 * Accepte:
 *   - string (texte simple)
 *   - array de blocks [{type:'text', text}, {type:'image_url', url}]
 *   - array de blocks Anthropic déjà au bon format
 */
function toAnthropicContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');

  const blocks = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      blocks.push({ type: 'text', text: block.text });
    } else if (block.type === 'image_url' && typeof block.url === 'string') {
      blocks.push({
        type: 'image',
        source: { type: 'url', url: block.url }
      });
    } else if (block.type === 'image' && block.source) {
      blocks.push(block);
    }
  }
  return blocks.length ? blocks : '';
}

/**
 * Transforme un message en string pour les providers non-multimodaux (Together/Llama).
 * Les URLs d'images deviennent des mentions textuelles.
 */
function toTextOnlyContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');

  return content.map(block => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'text') return block.text || '';
    if (block.type === 'image_url') return `[image: ${block.url}]`;
    if (block.type === 'image' && block.source?.url) return `[image: ${block.source.url}]`;
    return '';
  }).filter(Boolean).join('\n');
}

/**
 * Appelle Anthropic Claude (provider principal, multimodal)
 */
async function callAnthropic(messages, systemPrompt) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.slice(-30).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: toAnthropicContent(m.content)
    }))
  });

  return response.content[0]?.text || "Je n'ai pas pu générer une réponse.";
}

/**
 * Appelle Together.ai / Llama 3.3 (fallback)
 */
async function callTogether(messages, systemPrompt) {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('TOGETHER_API_KEY non configurée');

  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-20).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: toTextOnlyContent(m.content)
        }))
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Together.ai error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "Je n'ai pas pu générer une réponse.";
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps de requête invalide' }) };
  }

  const { messages, propertyData, email, clientContext } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages manquants' }) };
  }

  // ══════════════════════════════════════════════════════════
  //  PROMPT SYSTÈME — Recomposé à chaque message depuis TOUTES
  //  les sources accumulées dans le pipeline (contexte stratifié)
  // ══════════════════════════════════════════════════════════
  let systemPrompt;
  let promptSource = 'default';

  let ctx = null;
  if (email) {
    try {
      ctx = await buildMarcelContext(email);
    } catch (err) {
      console.warn(`Marcel: build context échoué pour ${email} — ${err.message}`);
    }
  }

  if (ctx && ctx.client) {
    // Enrichir avec les données propertyData passées par le front (redondant mais OK)
    if (propertyData && (!ctx.scan || !ctx.scan.matterport_data)) {
      ctx.scan = Object.assign({}, ctx.scan, { matterport_data: propertyData });
    }
    // Métadonnées photos passées par le front (Sprint 2)
    if (clientContext && Array.isArray(clientContext.photosMeta)) {
      ctx.photosMeta = clientContext.photosMeta;
    }

    systemPrompt = composeMarcelPrompt(ctx);
    promptSource = 'stratified';
    console.log(`Marcel: contexte stratifié chargé pour ${email} (phone_summary=${!!ctx.phoneSummary}, scan_observation=${!!ctx.scanObservation}, matterport=${!!(ctx.scan && ctx.scan.matterport_data)})`);
  } else {
    // Fallback : prompt par défaut (cas où email manque ou client inconnu)
    systemPrompt = MARCEL_SYSTEM_PROMPT;
    const matterportSummary = formatMatterportData(propertyData);
    systemPrompt = systemPrompt.replace(
      '{{PROPERTY_DATA}}',
      matterportSummary || 'Aucune donnée de bien disponible pour le moment.'
    );
    console.log(`Marcel: fallback prompt générique (email=${email || 'absent'}, ctx=${!!ctx})`);
  }

  // Directives additionnelles selon le contexte interactif (photos envoyées, trigger, etc.)
  systemPrompt += buildPhotoDirective(clientContext);

  // ══════════════════════════════════════════════════════════
  //  CASCADE : Claude → Together.ai
  // ══════════════════════════════════════════════════════════
  const providers = [];
  let usedProvider = 'unknown';

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({ name: 'claude', fn: callAnthropic });
  }

  if (process.env.TOGETHER_API_KEY) {
    providers.push({ name: 'together', fn: callTogether });
  }

  if (providers.length === 0) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Aucun provider IA configuré (ANTHROPIC_API_KEY ou TOGETHER_API_KEY requis).' })
    };
  }

  let replyText;
  let lastError;

  for (const provider of providers) {
    try {
      console.log(`Marcel: essai via ${provider.name}...`);
      replyText = await provider.fn(messages, systemPrompt);
      usedProvider = provider.name;
      console.log(`Marcel: réponse via ${provider.name} ✓`);
      break;
    } catch (err) {
      console.warn(`Marcel: ${provider.name} a échoué — ${err.message}`);
      lastError = err;
    }
  }

  if (replyText) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ content: replyText, provider: usedProvider, promptSource })
    };
  }

  console.error('Marcel: tous les providers ont échoué. Dernière erreur:', lastError?.message);
  return {
    statusCode: 500, headers,
    body: JSON.stringify({
      error: "Erreur lors de la communication avec l'IA. Réessayez dans un instant."
    })
  };
};
