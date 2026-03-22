/**
 * Scantorenov — Fonction serverless Netlify
 * Marcel : assistant IA de rénovation
 *
 * Cascade intelligente :
 *   1. Anthropic Claude (priorité — meilleure qualité)
 *   2. Together.ai / Llama 3.1 (fallback fiable)
 *   3. Ollama (fallback local dev)
 *
 * Prompt personnalisé :
 *   Si un marcel_system_prompt existe dans Supabase pour ce client (généré
 *   à la soumission du formulaire contact), il est utilisé À LA PLACE du
 *   prompt par défaut. Il contient les 3 missions : rôle, scénario client,
 *   directives de cohérence budget/surface/travaux.
 */

const { createClient } = require('@supabase/supabase-js');

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
 * Appelle Ollama (local) — gratuit, illimité
 */
async function callOllama(messages, systemPrompt) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || 'mistral',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error: ${err}`);
  }

  const data = await response.json();
  return data.message?.content || "Je n'ai pas pu générer une réponse.";
}

/**
 * Appelle Anthropic Claude (priorité n°1)
 */
async function callAnthropic(messages, systemPrompt) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))
  });

  return response.content[0]?.text || "Je n'ai pas pu générer une réponse.";
}

/**
 * Appelle Together.ai / Llama 3.1 (fallback n°2)
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
          content: m.content
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

/**
 * Récupère le prompt Marcel personnalisé depuis Supabase pour un client.
 * Ce prompt est généré par marcel-prompt.js à la soumission du formulaire.
 * Il contient : rôle + scénario client + directives de cohérence.
 * @param {string} email - Email du client
 * @returns {string|null} Le prompt personnalisé ou null
 */
async function getClientMarcelPrompt(email) {
  if (!email) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('clients')
      .select('marcel_system_prompt')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data || !data.marcel_system_prompt) return null;
    return data.marcel_system_prompt;
  } catch (err) {
    console.warn('Marcel: récupération prompt Supabase échouée:', err.message);
    return null;
  }
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

  const { messages, propertyData, email } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages manquants' }) };
  }

  // ══════════════════════════════════════════════════════════
  //  PROMPT SYSTÈME : Personnalisé (Supabase) ou par défaut
  //  Si un marcel_system_prompt existe pour ce client, il est
  //  utilisé car il contient les 3 missions (rôle, scénario,
  //  directives de cohérence) forgées depuis le formulaire.
  // ══════════════════════════════════════════════════════════
  let systemPrompt;
  let promptSource = 'default';

  const clientPrompt = await getClientMarcelPrompt(email);
  if (clientPrompt) {
    // Prompt personnalisé trouvé — l'utiliser comme base
    systemPrompt = clientPrompt;
    promptSource = 'supabase';
    console.log(`Marcel: prompt personnalisé chargé pour ${email}`);

    // Enrichir avec les données du scan 3D si disponibles
    if (propertyData) {
      systemPrompt += `\n\n═══════════════════════════════════════════════════════
DONNÉES DU SCAN 3D MATTERPORT
═══════════════════════════════════════════════════════
${JSON.stringify(propertyData, null, 2)}`;
    }
  } else {
    // Pas de prompt personnalisé — utiliser le prompt par défaut
    systemPrompt = MARCEL_SYSTEM_PROMPT;
    if (propertyData) {
      systemPrompt = systemPrompt.replace('{{PROPERTY_DATA}}', JSON.stringify(propertyData, null, 2));
    } else {
      systemPrompt = systemPrompt.replace('{{PROPERTY_DATA}}', 'Aucune donnée de bien disponible pour le moment.');
    }
  }

  // ══════════════════════════════════════════════════════════
  //  CASCADE INTELLIGENTE : Claude → Together → Ollama
  //  Chaque provider est essayé. Si l'un échoue, on passe
  //  au suivant automatiquement.
  // ══════════════════════════════════════════════════════════

  const providers = [];
  let usedProvider = 'unknown';

  // 1. Anthropic Claude (priorité — meilleure qualité français)
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-REMPLACER_PAR_VOTRE_CLÉ') {
    providers.push({ name: 'claude', fn: callAnthropic });
  }

  // 2. Together.ai / Llama 3.1 (fallback cloud fiable)
  if (process.env.TOGETHER_API_KEY) {
    providers.push({ name: 'together', fn: callTogether });
  }

  // 3. Ollama (fallback local dev)
  providers.push({ name: 'ollama', fn: callOllama });

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

  // Tous les providers ont échoué
  console.error('Marcel: tous les providers ont échoué. Dernière erreur:', lastError?.message);
  return {
    statusCode: 500, headers,
    body: JSON.stringify({
      error: "Erreur lors de la communication avec l'IA. Réessayez dans un instant.",
      details: process.env.NODE_ENV === 'development' ? lastError?.message : undefined
    })
  };
};
