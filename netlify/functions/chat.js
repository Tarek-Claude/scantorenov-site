/**
 * Scantorenov — Fonction serverless Netlify
 * Proxy sécurisé vers l'API Claude (Anthropic)
 *
 * ARCHITECTURE :
 *   1. Le client envoie {messages, email} depuis l'espace client
 *   2. On récupère le prompt Marcel personnalisé depuis Supabase (via email)
 *   3. On appelle Claude avec ce prompt contextualisé
 *   4. Si aucun prompt personnalisé n'existe, on utilise le prompt par défaut
 *
 * Configuration requise dans Netlify :
 *   ANTHROPIC_API_KEY = sk-ant-api03-xxxx
 *   SUPABASE_URL = https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY = eyJ...
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

/* ── Prompt par défaut (fallback si pas de données formulaire) ── */
const DEFAULT_SYSTEM_PROMPT = `Tu es Marcel, l'assistant expert en maîtrise d'œuvre de Reno'Island pour la plateforme ScanToRenov. Ton but est d'accompagner le client dans la définition de son avant-projet de rénovation, de le conseiller techniquement, et de l'aider à formuler des requêtes pertinentes pour générer des visuels d'inspiration.

Tu t'exprimes avec professionnalisme, élégance et bienveillance. Tu vouvoies le client par défaut. Tu es précis, concret et pédagogue. Tu ne prends jamais d'engagement contractuel au nom de Scantorenov. Pour toute question sur les tarifs, tu invites le client à consulter son devis ou à contacter contact@scantorenov.com.

Ton rôle est d'aider les clients de Scantorenov à :
- Imaginer et concevoir leur projet de rénovation
- Comprendre les possibilités techniques (abattage de cloisons, extensions, changements de destination...)
- Estimer des fourchettes budgétaires indicatives
- Identifier les aides financières disponibles (MaPrimeRénov', CEE, éco-PTZ, ANAH, TVA réduite...)
- Préparer leurs questions pour les échanges avec le maître d'œuvre

Tu mentionnes toujours que tes estimations budgétaires sont indicatives et qu'un devis officiel sera établi par le maître d'œuvre.

Réponds toujours en français.`;

/**
 * Récupère le prompt Marcel personnalisé depuis Supabase pour un client donné.
 * @param {string} email - Email du client
 * @returns {string|null} Le prompt personnalisé ou null
 */
async function getClientPrompt(email) {
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
    console.error('Erreur récupération prompt Supabase:', err.message);
    return null;
  }
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Clé API non configurée.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps de requête invalide' }) };
  }

  const { messages, email } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages manquants' }) };
  }

  const recentMessages = messages.slice(-20);

  try {
    // Récupérer le prompt personnalisé Marcel (si disponible)
    const clientPrompt = await getClientPrompt(email);
    const systemPrompt = clientPrompt || DEFAULT_SYSTEM_PROMPT;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    });

    const replyText = response.content[0]?.text || "Je n'ai pas pu générer une réponse.";

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        content: replyText,
        personalized: !!clientPrompt  // Indique si le prompt Marcel a été utilisé
      })
    };

  } catch (err) {
    console.error('Erreur API Anthropic:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Erreur lors de la communication avec l'IA. Réessayez dans un instant." })
    };
  }
};
